"""Statement of Claim draft (صحيفة دعوى عمالية), FR10.

The LLM writes only the wording (subject, facts, legal grounds, requests) from the
masked case. Code then adds everything sensitive or numeric:
- party details (name, ID, phone, address, CR number) from the encrypted vault and the
  claim form: never sent to the LLM;
- amounts from app.entitlements: never written by the LLM;
- fixed procedural notes.
Legal grounds are checked against the articles retrieved for the case, like the analysis.
"""
from sqlalchemy.orm import Session

from app.analysis import DISCLAIMER, articles_by_id, entitlement_results, parse_result
from app.gemini import generate
from app.models import Case, CaseClaim
from app.privacy import unmask
from app.prompts import CLAIM_PROMPT_VERSION, CLAIM_SYSTEM_PROMPT
from app.schemas import ClaimGroundOut, ClaimOut, ClaimParty, ClaimRequest, ClaimRequestOut, LLMClaim
from app.vault import seal, unseal

BASE_NOTES = [
    "هذه مسودة آلية للمراجعة، ويُنصح بمراجعتها من محامٍ مرخص قبل تقديمها.",
    "يُشترط قبل رفع الدعوى العمالية تقديم طلب التسوية الودية لدى وزارة الموارد البشرية والتنمية الاجتماعية.",
    "المبالغ محسوبة آلياً وفق مواد النظام على أساس الوقائع المذكورة؛ تحقق من الأجر ومدة الخدمة قبل التقديم.",
    "أكمل الحقول المنقوطة (……) قبل التقديم.",
]


def _first(mapping: dict[str, str], kind: str) -> str | None:
    for placeholder, value in mapping.items():
        if placeholder.startswith(f"[{kind}_"):
            return value
    return None


def _claim_prompt(case: Case, articles_block: str, entitlements_block: str) -> str:
    latest = parse_result(case.analyses[-1].result)
    return f"""المواد النظامية المتاحة (لا تعتمد على غيرها):
{articles_block}

---
جدول المستحقات المالية المنطبقة (اختر منها kind للطلبات المالية):
{entitlements_block or "لا توجد مستحقات مالية محددة."}

---
وصف الحالة من المدعي:
{case.masked_description}

---
ملخص التحليل القانوني:
الوقائع: {latest.facts_summary}
المسائل: {"؛ ".join(latest.legal_issues)}
التحليل: {latest.analysis}

صُغ مسودة صحيفة الدعوى وفق القواعد، وأجب بصيغة JSON المطلوبة."""


def generate_claim(db: Session, case: Case, req: ClaimRequest) -> CaseClaim:
    latest = case.analyses[-1]
    articles = articles_by_id(db, latest.retrieved_record_ids)
    articles_block = "\n\n".join(
        f"[{a.record_id}] {a.source_name} | {a.title}\n{a.text[:3000]}" for a in articles.values() if a.status == "in_force"
    )
    entitlements, _ = entitlement_results(parse_result(latest.result), latest.created_at.date())
    entitlements_block = "\n".join(f"- {e.kind}: {e.title_ar} (المادة {e.article})" for e in entitlements)

    llm, model_version = generate(
        _claim_prompt(case, articles_block, entitlements_block), system=CLAIM_SYSTEM_PROMPT, schema=LLMClaim
    )
    warnings = [
        f"أُزيل سند نظامي بمعرّف غير موجود في المواد المسترجعة: {g.record_id}"
        for g in llm.legal_grounds
        if g.record_id not in articles
    ]
    llm = llm.model_copy(update={"legal_grounds": [g for g in llm.legal_grounds if g.record_id in articles]})

    claim = CaseClaim(
        prompt_version=CLAIM_PROMPT_VERSION,
        model_version=model_version,
        result=llm.model_dump(),
        party_vault=seal({k: v for k, v in req.model_dump().items() if v}),
        grounding_warnings=warnings,
    )
    case.claims.append(claim)
    db.commit()
    return claim


def claim_view(db: Session, case: Case, claim: CaseClaim) -> ClaimOut:
    mapping = unseal(case.pii_vault)
    party = unseal(claim.party_vault)
    llm = LLMClaim.model_validate(unmask(claim.result, mapping))

    articles = articles_by_id(db, [g.record_id for g in llm.legal_grounds])
    entitlements, _ = entitlement_results(parse_result(case.analyses[-1].result), case.analyses[-1].created_at.date())
    by_kind = {e.kind: e for e in entitlements if e.amount is not None}

    requests = []
    for r in llm.requests:
        e = by_kind.get(r.kind) if r.kind != "other" else None
        requests.append(ClaimRequestOut(text=r.text, amount=e.amount if e else None, formula=e.formula_ar if e else None))
    amounts = [r.amount for r in requests if r.amount is not None]

    notes = list(BASE_NOTES)
    if parse_result(case.analyses[-1].result).expected_outcome.likelihood == "منخفض":
        notes.insert(0, "تنبيه: رجّح التحليل ضعف موقف المدعي في هذه الحالة؛ راجع التحليل قبل رفع الدعوى.")

    return ClaimOut(
        claim_id=claim.id,
        case_id=case.id,
        created_at=claim.created_at,
        model_version=claim.model_version,
        court_city=party.get("court_city"),
        plaintiff=[
            ClaimParty(label="الاسم", value=_first(mapping, "EMPLOYEE") or _first(mapping, "PERSON")),
            ClaimParty(label="رقم الهوية / الإقامة", value=party.get("plaintiff_national_id") or _first(mapping, "NATIONAL_ID")),
            ClaimParty(label="الجنسية", value=party.get("plaintiff_nationality")),
            ClaimParty(label="رقم الجوال", value=party.get("plaintiff_phone") or _first(mapping, "PHONE")),
            ClaimParty(label="العنوان", value=party.get("plaintiff_address")),
        ],
        defendant=[
            ClaimParty(label="اسم المنشأة / صاحب العمل", value=_first(mapping, "EMPLOYER")),
            ClaimParty(label="السجل التجاري / الرقم الموحد", value=party.get("defendant_cr_number")),
            ClaimParty(label="العنوان", value=party.get("defendant_address")),
        ],
        subject=llm.subject,
        facts=llm.facts,
        legal_grounds=[
            ClaimGroundOut(
                record_id=g.record_id,
                title=f"{articles[g.record_id].title} من {articles[g.record_id].source_name}",
                argument=g.argument,
            )
            for g in llm.legal_grounds
            if g.record_id in articles
        ],
        requests=requests,
        total=round(sum(amounts), 2) if amounts else None,
        notes=notes,
        grounding_warnings=claim.grounding_warnings,
        disclaimer=DISCLAIMER,
    )
