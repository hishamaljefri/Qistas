"""Cases: analyze (FR3); My Cases (FR12): list, view, rename, edit + re-analyze, delete;
claim draft (FR10); downloads (FR13).

All routes require login. A user can only reach their own cases; admins can reach any.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from google.genai import errors as gemini_errors
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analysis import parse_result, case_title, case_view, create_case, entitlement_results, reanalyze_case, rename_case
from app.auth import current_user
from app.claim import claim_view, generate_claim
from app.exports import claim_docx, claim_pdf, report_pdf
from app.db import get_db
from app.models import Case, User
from app.schemas import AnalyzeRequest, AnalyzeResponse, CaseRename, CaseSummary, ClaimOut, ClaimRequest, ReanalyzeRequest
from app.vault import unseal

log = logging.getLogger("qistas")
router = APIRouter(prefix="/api/cases", tags=["cases"])

AI_BUSY = "خدمة الذكاء الاصطناعي مشغولة حالياً، يرجى المحاولة بعد قليل"


def owned_case(case_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Case:
    case = db.get(Case, case_id)
    # 404 (not 403) for other people's cases, so case ids can't be probed
    if case is None or (case.user_id != user.id and user.role != "admin") or not case.analyses:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "القضية غير موجودة")
    return case


@router.post("/analyze", response_model=AnalyzeResponse, status_code=status.HTTP_201_CREATED)
def analyze(req: AnalyzeRequest, user: User = Depends(current_user), db: Session = Depends(get_db)) -> AnalyzeResponse:
    try:
        case_id = create_case(user, req)
    except gemini_errors.APIError as e:
        log.warning("Gemini error %s: %s", e.code, e.message)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, AI_BUSY) from e
    return case_view(db, db.get(Case, case_id))


@router.get("", response_model=list[CaseSummary])
def my_cases(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[CaseSummary]:
    cases = db.scalars(select(Case).where(Case.user_id == user.id).order_by(Case.updated_at.desc())).all()
    out = []
    for case in cases:
        if not case.analyses:
            continue
        llm = parse_result(case.analyses[-1].result)
        _, total = entitlement_results(llm, case.analyses[-1].created_at.date())
        out.append(
            CaseSummary(
                case_id=case.id,
                title=case_title(case, unseal(case.pii_vault)),
                created_at=case.created_at,
                updated_at=case.updated_at,
                likelihood=llm.expected_outcome.likelihood,
                entitlements_total=total,
                version=len(case.analyses),
                has_claim=bool(case.claims),
            )
        )
    return out


@router.get("/{case_id}", response_model=AnalyzeResponse)
def get_case(case: Case = Depends(owned_case), db: Session = Depends(get_db)) -> AnalyzeResponse:
    return case_view(db, case)


@router.patch("/{case_id}", response_model=AnalyzeResponse)
def rename(req: CaseRename, case: Case = Depends(owned_case), db: Session = Depends(get_db)) -> AnalyzeResponse:
    rename_case(db, case, req.title.strip())
    return case_view(db, case)


@router.post("/{case_id}/reanalyze", response_model=AnalyzeResponse)
def reanalyze(req: ReanalyzeRequest, case: Case = Depends(owned_case), db: Session = Depends(get_db)) -> AnalyzeResponse:
    try:
        reanalyze_case(db, case, req)
    except gemini_errors.APIError as e:
        log.warning("Gemini error %s: %s", e.code, e.message)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, AI_BUSY) from e
    db.refresh(case)
    return case_view(db, case)


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(case: Case = Depends(owned_case), db: Session = Depends(get_db)) -> Response:
    db.delete(case)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- claim draft (FR10) ----------


def _latest_claim(case: Case):
    if not case.claims:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "لم تُنشأ مسودة صحيفة دعوى لهذه القضية بعد")
    return case.claims[-1]


@router.post("/{case_id}/claim", response_model=ClaimOut, status_code=status.HTTP_201_CREATED)
def create_claim(req: ClaimRequest, case: Case = Depends(owned_case), db: Session = Depends(get_db)) -> ClaimOut:
    try:
        claim = generate_claim(db, case, req)
    except gemini_errors.APIError as e:
        log.warning("Gemini error %s: %s", e.code, e.message)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, AI_BUSY) from e
    return claim_view(db, case, claim)


@router.get("/{case_id}/claim", response_model=ClaimOut)
def get_claim(case: Case = Depends(owned_case), db: Session = Depends(get_db)) -> ClaimOut:
    return claim_view(db, case, _latest_claim(case))


# ---------- downloads (FR13) ----------

PDF = "application/pdf"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _file(content: bytes, media_type: str, filename: str) -> Response:
    return Response(content, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/{case_id}/report.pdf", response_class=Response)
def download_report(case: Case = Depends(owned_case), db: Session = Depends(get_db)) -> Response:
    return _file(report_pdf(case_view(db, case)), PDF, f"qistas-case-{case.id}-report.pdf")


@router.get("/{case_id}/claim.pdf", response_class=Response)
def download_claim_pdf(case: Case = Depends(owned_case), db: Session = Depends(get_db)) -> Response:
    return _file(claim_pdf(claim_view(db, case, _latest_claim(case))), PDF, f"qistas-case-{case.id}-claim.pdf")


@router.get("/{case_id}/claim.docx", response_class=Response)
def download_claim_docx(case: Case = Depends(owned_case), db: Session = Depends(get_db)) -> Response:
    return _file(claim_docx(claim_view(db, case, _latest_claim(case))), DOCX, f"qistas-case-{case.id}-claim.docx")
