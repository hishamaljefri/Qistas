"""Case analysis pipeline: mask -> retrieve -> generate -> check grounding -> save -> unmask."""
import time
from dataclasses import asdict

from google.genai import errors, types
from sqlalchemy import func, select

from app.config import GEMINI_CHAT_MODEL, GEMINI_FALLBACK_MODELS
from app.db import SessionLocal
from app.entitlements import calculate
from app.expansion import expand
from app.gemini import RETRYABLE_CODES, get_client, with_retry
from app.models import Case, CaseAnalysis, LegalSource
from app.privacy import mask, unmask
from app.prompts import PROMPT_VERSION, SYSTEM_PROMPT, build_user_prompt
from app.schemas import (
    AnalysisOut,
    AnalyzeRequest,
    AnalyzeResponse,
    ArticleOut,
    CitationOut,
    LLMAnalysis,
)
from app.search import SearchResult, search

RETRIEVAL_K = 8
MAX_ARTICLE_CHARS = 4000  # keep very long regulations articles from crowding out the rest

DISCLAIMER = (
    "هذا التحليل آلي لأغراض توعوية ومعلوماتية فقط، ويعتمد على المواد النظامية المسترجعة وعلى الوقائع كما وردت في الوصف. "
    "لا يُعد استشارة قانونية ولا يغني عن مراجعة محامٍ مرخص أو الجهات المختصة."
)


def format_articles(results: list[SearchResult]) -> str:
    blocks = []
    for r in results:
        status = "" if r.status == "in_force" else f" | الحالة: {'ملغاة' if r.status == 'repealed' else 'مدمجة'}"
        text = r.text if len(r.text) <= MAX_ARTICLE_CHARS else r.text[:MAX_ARTICLE_CHARS] + " …(مقتطع)"
        blocks.append(f"[{r.record_id}] {r.source_name} | {r.title}{status}\n{text}")
    return "\n\n".join(blocks)


def check_grounding(llm: LLMAnalysis, retrieved_ids: set[str]) -> tuple[LLMAnalysis, list[str]]:
    """Remove citations of articles that were not given to the model."""
    warnings = []
    kept = []
    for c in llm.applicable_articles:
        if c.record_id in retrieved_ids:
            kept.append(c)
        else:
            warnings.append(f"أُزيل استشهاد بمعرّف غير موجود في المواد المسترجعة: {c.record_id}")
    return llm.model_copy(update={"applicable_articles": kept}), warnings


def _article_out(r: SearchResult) -> ArticleOut:
    return ArticleOut(**{k: v for k, v in asdict(r).items() if k in ArticleOut.model_fields})


def _generate(
    masked_description: str, results: list[SearchResult], known_facts: list[str]
) -> tuple[LLMAnalysis, str | None]:
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        response_mime_type="application/json",
        response_schema=LLMAnalysis,
        temperature=0.2,  # low = consistent, factual answers
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )
    prompt = build_user_prompt(masked_description, format_articles(results), known_facts)

    models = [GEMINI_CHAT_MODEL, *GEMINI_FALLBACK_MODELS]
    for i, model in enumerate(models):
        try:
            response = with_retry(
                lambda: get_client().models.generate_content(model=model, contents=prompt, config=config),
                max_retries=2,
                first_wait=4,
            )
            break
        except errors.APIError as e:
            if e.code not in RETRYABLE_CODES or i == len(models) - 1:
                raise
            print(f"  {model} unavailable ({e.code}), switching to {models[i + 1]}")
    parsed = response.parsed if isinstance(response.parsed, LLMAnalysis) else LLMAnalysis.model_validate_json(response.text)
    return parsed, response.model_version or model


def analyze_case(req: AnalyzeRequest) -> AnalyzeResponse:
    started = time.monotonic()

    masked = mask(req.description, employee_name=req.employee_name, employer_name=req.employer_name)
    results = expand(search(masked.masked_text, k=RETRIEVAL_K))
    by_id = {r.record_id: r for r in results}

    known_facts = []
    if req.employee_gender:
        known_facts.append("جنس العامل: " + ("أنثى" if req.employee_gender == "female" else "ذكر"))

    llm, model_version = _generate(masked.masked_text, results, known_facts)
    llm, warnings = check_grounding(llm, set(by_id))
    latency_ms = int((time.monotonic() - started) * 1000)

    with SessionLocal.begin() as session:
        case = Case(masked_description=masked.masked_text, pii_counts=masked.counts)
        case.analyses.append(
            CaseAnalysis(
                prompt_version=PROMPT_VERSION,
                model_requested=GEMINI_CHAT_MODEL,
                model_version=model_version,
                retrieved_record_ids=list(by_id),
                result=llm.model_dump(),
                grounding_warnings=warnings,
                latency_ms=latency_ms,
            )
        )
        session.add(case)
        session.flush()
        case_id = case.id
        kb_as_of = session.scalar(select(func.min(LegalSource.collected_on)))

    # Restore the user's real names/numbers only in what we send back to them.
    shown = LLMAnalysis.model_validate(unmask(llm.model_dump(), masked.mapping))
    citations = [
        CitationOut(**_article_out(by_id[c.record_id]).model_dump(), why=c.why) for c in shown.applicable_articles
    ]
    entitlements = [calculate(e) for e in llm.entitlements]
    # the deduction cap is a limit, not money owed, so it is not added to the total
    computable = [e.amount for e in entitlements if e.amount is not None and e.kind != "damage_deduction_cap"]
    return AnalyzeResponse(
        case_id=case_id,
        analysis=AnalysisOut(**shown.model_dump(exclude={"applicable_articles", "entitlements"})),
        citations=citations,
        entitlements=entitlements,
        entitlements_total=round(sum(computable), 2) if computable else None,
        retrieved=[_article_out(r) for r in results],
        masked_description=masked.masked_text,
        pii_masked=masked.counts,
        grounding_warnings=warnings,
        knowledge_base_as_of=kb_as_of,
        model_version=model_version,
        latency_ms=latency_ms,
        disclaimer=DISCLAIMER,
    )
