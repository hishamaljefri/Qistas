"""QISTAS web API.

Run (from backend/):  uv run uvicorn app.api:app --reload
Interactive docs:     http://127.0.0.1:8000/docs
"""
import logging
from dataclasses import asdict

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from google.genai import errors as gemini_errors
from sqlalchemy import func, select, text

from app.analysis import DISCLAIMER, analyze_case
from app.db import SessionLocal
from app.models import Case, LegalProvision, LegalSource
from app.schemas import AnalyzeRequest, AnalyzeResponse, ArticleOut, KBInfo, SearchHit, SourceOut
from app.search import search

log = logging.getLogger("qistas")

app = FastAPI(
    title="QISTAS API",
    description="مساعد قانوني ذكي لقضايا نظام العمل السعودي",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Next.js dev server
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    with SessionLocal() as session:
        session.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.get("/api/kb/info", response_model=KBInfo)
def kb_info() -> KBInfo:
    with SessionLocal() as session:
        sources = session.scalars(select(LegalSource).order_by(LegalSource.id)).all()
        count = session.scalar(select(func.count(LegalProvision.id)))
        return KBInfo(
            sources=[SourceOut.model_validate(s, from_attributes=True) for s in sources],
            provisions=count,
            knowledge_base_as_of=min(s.collected_on for s in sources),
        )


@app.get("/api/search", response_model=list[SearchHit])
def search_law(
    q: str = Query(min_length=2, max_length=500, description="سؤال أو كلمات بحث"),
    k: int = Query(default=8, ge=1, le=30),
    mode: str = Query(default="hybrid", pattern="^(hybrid|vector|keyword)$"),
) -> list[SearchHit]:
    return [SearchHit(**{f: v for f, v in asdict(r).items() if f in SearchHit.model_fields}) for r in search(q, k, mode)]


@app.get("/api/provisions/{record_id}", response_model=ArticleOut)
def get_provision(record_id: str) -> ArticleOut:
    with SessionLocal() as session:
        p = session.scalar(select(LegalProvision).where(LegalProvision.record_id == record_id))
        if p is None:
            raise HTTPException(404, "المادة غير موجودة")
        return ArticleOut(
            record_id=p.record_id,
            source_code=p.source.code,
            source_name=p.source.name_ar,
            article_number=p.article_number,
            title=p.title_ar,
            text=p.text_ar,
            status=p.status,
            status_note=p.status_note,
        )


@app.post("/api/cases/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    try:
        return analyze_case(req)
    except gemini_errors.APIError as e:
        log.warning("Gemini error %s: %s", e.code, e.message)
        raise HTTPException(503, "خدمة الذكاء الاصطناعي مشغولة حالياً، يرجى المحاولة بعد قليل") from e


@app.get("/api/cases/{case_id}")
def get_case(case_id: int) -> dict:
    """A saved case. Returned masked: the original names/IDs are never stored."""
    with SessionLocal() as session:
        case = session.get(Case, case_id)
        if case is None:
            raise HTTPException(404, "القضية غير موجودة")
        latest = case.analyses[-1] if case.analyses else None
        return {
            "case_id": case.id,
            "created_at": case.created_at,
            "masked_description": case.masked_description,
            "pii_masked": case.pii_counts,
            "analysis": latest.result if latest else None,
            "retrieved_record_ids": latest.retrieved_record_ids if latest else [],
            "model_version": latest.model_version if latest else None,
            "disclaimer": DISCLAIMER,
        }
