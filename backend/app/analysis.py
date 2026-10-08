"""Case analysis pipeline: mask -> retrieve -> generate -> check grounding -> save -> unmask.

Every case belongs to a user. The database stores masked text only; the real values
behind the placeholders are kept in the case's encrypted vault (app.vault) and restored
only in what is shown to the owner.
"""
import time
from dataclasses import asdict
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import GEMINI_CHAT_MODEL
from app.db import SessionLocal
from app.entitlements import EntitlementResult, calculate, share_facts
from app.expansion import expand
from app.gemini import generate
from app.models import Case, CaseAnalysis, CaseDocument, LegalProvision, LegalSource, User
from app.privacy import mask_many, unmask
from app.prompts import PROMPT_VERSION, SYSTEM_PROMPT, build_user_prompt
from app.schemas import (
    AnalysisOut,
    AnalyzeRequest,
    AnalyzeResponse,
    ArticleOut,
    CitationOut,
    DocumentOut,
    LLMAnalysis,
    ReanalyzeRequest,
)
from app.search import SearchResult, search
from app.vault import seal, unseal

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


def _known_facts(gender: str | None) -> list[str]:
    if not gender:
        return []
    return ["جنس العامل: " + ("أنثى" if gender == "female" else "ذكر")]


def _run(masked_description: str, documents: list[tuple[str, str]], gender: str | None) -> CaseAnalysis:
    """Retrieve articles and ask the LLM. Returns an unsaved CaseAnalysis row (masked result)."""
    started = time.monotonic()
    query = masked_description + "".join(f"\n{text[:2000]}" for _, text in documents)
    results = expand(search(query, k=RETRIEVAL_K))
    prompt = build_user_prompt(masked_description, format_articles(results), _known_facts(gender), documents, today=date.today())
    llm, model_version = generate(prompt, system=SYSTEM_PROMPT, schema=LLMAnalysis)
    llm, warnings = check_grounding(llm, {r.record_id for r in results})
    return CaseAnalysis(
        prompt_version=PROMPT_VERSION,
        model_requested=GEMINI_CHAT_MODEL,
        model_version=model_version,
        retrieved_record_ids=[r.record_id for r in results],
        result=llm.model_dump(),
        grounding_warnings=warnings,
        latency_ms=int((time.monotonic() - started) * 1000),
    )


def _pii_counts(mapping: dict[str, str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for placeholder in mapping:
        kind = placeholder.strip("[]").rsplit("_", 1)[0]
        counts[kind] = counts.get(kind, 0) + 1
    return counts


def create_case(user: User, req: AnalyzeRequest) -> int:
    texts = [req.description] + [d.filename for d in req.documents] + [d.text for d in req.documents]
    masked, mapping = mask_many(texts, employee_name=req.employee_name, employer_name=req.employer_name)
    n = len(req.documents)
    masked_description, masked_names, masked_texts = masked[0], masked[1 : 1 + n], masked[1 + n :]

    analysis = _run(masked_description, list(zip(masked_names, masked_texts)), req.employee_gender)

    with SessionLocal.begin() as db:
        case = Case(
            user_id=user.id,
            title=analysis.result.get("title") or None,
            masked_description=masked_description,
            employee_gender=req.employee_gender,
            pii_counts=_pii_counts(mapping),
            pii_vault=seal(mapping),
        )
        case.analyses.append(analysis)
        for doc, name, text in zip(req.documents, masked_names, masked_texts):
            case.documents.append(CaseDocument(filename=name, method=doc.method, pages=doc.pages, masked_text=text))
        db.add(case)
        db.flush()
        return case.id


def reanalyze_case(db: Session, case: Case, req: ReanalyzeRequest) -> None:
    """FR12 'edit': the user edits the description; a new analysis version is added."""
    existing = unseal(case.pii_vault)
    (masked_description,), mapping = mask_many(
        [req.description], employee_name=req.employee_name, employer_name=req.employer_name, existing=existing
    )
    gender = req.employee_gender or case.employee_gender
    documents = [(d.filename, d.masked_text) for d in case.documents]
    analysis = _run(masked_description, documents, gender)

    case.masked_description = masked_description
    case.employee_gender = gender
    case.pii_vault = seal(mapping)
    case.pii_counts = _pii_counts(mapping)
    case.analyses.append(analysis)
    db.commit()


def rename_case(db: Session, case: Case, title: str) -> None:
    """Titles may contain names too, so they are masked like everything else."""
    (masked_title,), mapping = mask_many([title], existing=unseal(case.pii_vault))
    case.title = masked_title
    case.pii_vault = seal(mapping)
    db.commit()


def parse_result(result: dict) -> LLMAnalysis:
    # analyses saved by earlier prompt versions lack some newer fields
    return LLMAnalysis.model_validate({"title": "", "entitlements": [], **result})


def entitlement_results(llm: LLMAnalysis, as_of: date | None = None) -> tuple[list[EntitlementResult], float | None]:
    """as_of: date of the analysis, used when service runs "until now" (no end date given)."""
    results = [calculate(e, as_of) for e in share_facts(llm.entitlements)]
    # the deduction cap is a limit, not money owed, so it is not added to the total
    computable = [e.amount for e in results if e.amount is not None and e.kind != "damage_deduction_cap"]
    return results, (round(sum(computable), 2) if computable else None)


def articles_by_id(db: Session, record_ids: list[str]) -> dict[str, ArticleOut]:
    rows = db.scalars(select(LegalProvision).where(LegalProvision.record_id.in_(record_ids))).all()
    return {
        p.record_id: ArticleOut(
            record_id=p.record_id,
            source_code=p.source.code,
            source_name=p.source.name_ar,
            article_number=p.article_number,
            title=p.title_ar,
            text=p.text_ar,
            status=p.status,
            status_note=p.status_note,
        )
        for p in rows
    }


def case_title(case: Case, mapping: dict[str, str]) -> str:
    title = case.title or (case.analyses[-1].result.get("title") if case.analyses else None)
    if not title:
        title = case.masked_description[:60] + ("…" if len(case.masked_description) > 60 else "")
    return unmask(title, mapping)


def case_view(db: Session, case: Case) -> AnalyzeResponse:
    """The case and its latest analysis, with real names restored (owner/admin only)."""
    mapping = unseal(case.pii_vault)
    latest = case.analyses[-1]
    masked_llm = parse_result(latest.result)
    shown = LLMAnalysis.model_validate(unmask(masked_llm.model_dump(), mapping))

    articles = articles_by_id(db, latest.retrieved_record_ids)
    citations = [
        CitationOut(**articles[c.record_id].model_dump(), why=c.why)
        for c in shown.applicable_articles
        if c.record_id in articles
    ]
    entitlements, total = entitlement_results(masked_llm, latest.created_at.date())
    return AnalyzeResponse(
        case_id=case.id,
        title=case_title(case, mapping),
        created_at=case.created_at,
        updated_at=case.updated_at,
        version=len(case.analyses),
        employee_gender=case.employee_gender,
        description=unmask(case.masked_description, mapping),
        documents=[DocumentOut(filename=unmask(d.filename, mapping), method=d.method, pages=d.pages) for d in case.documents],
        latest_claim_id=case.claims[-1].id if case.claims else None,
        analysis=AnalysisOut(**shown.model_dump(exclude={"applicable_articles", "entitlements", "title"})),
        citations=citations,
        entitlements=entitlements,
        entitlements_total=total,
        retrieved=[articles[r] for r in latest.retrieved_record_ids if r in articles],
        masked_description=case.masked_description,
        pii_masked=case.pii_counts or {},
        grounding_warnings=latest.grounding_warnings,
        knowledge_base_as_of=db.scalar(select(func.min(LegalSource.collected_on))),
        model_version=latest.model_version,
        latency_ms=latest.latency_ms,
        disclaimer=DISCLAIMER,
    )


def article_out(r: SearchResult) -> ArticleOut:
    return ArticleOut(**{k: v for k, v in asdict(r).items() if k in ArticleOut.model_fields})
