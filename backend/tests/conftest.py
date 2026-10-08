"""Test setup: API tests run against the separate `qistas_test` database with Gemini faked.

The environment variable is set before any `app` module is imported, so the app's
engine points at the test database. Each API test starts with no users or cases.
"""
import os
import re
from datetime import date
from pathlib import Path

from dotenv import dotenv_values

_env = dotenv_values(Path(__file__).resolve().parents[2] / ".env")
os.environ["DATABASE_URL"] = re.sub(r"/qistas$", "/qistas_test", _env["DATABASE_URL"])

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select, text  # noqa: E402

from app import analysis, claim, documents  # noqa: E402
from app.db import SessionLocal, engine  # noqa: E402
from app.models import LegalProvision, LegalSource  # noqa: E402
from app.schemas import (  # noqa: E402
    CitedArticle,
    ExpectedOutcome,
    LLMAnalysis,
    LLMClaim,
    LLMClaimGround,
    LLMClaimRequest,
)
from app.entitlements import EntitlementInputs  # noqa: E402
from app.search import SearchResult  # noqa: E402

assert "qistas_test" in str(engine.url), "tests must never run against the real database"

ARTICLES = {
    "LAW-0077": ("77", "المادة السابعة والسبعون", "يستحق الطرف المتضرر من إنهاء العقد لسبب غير مشروع تعويضاً..."),
    "LAW-0080": ("80", "المادة الثمانون", "لا يجوز لصاحب العمل فسخ العقد دون مكافأة العامل أو إشعاره أو تعويضه إلا في الحالات الآتية..."),
    "LAW-0084": ("84", "المادة الرابعة والثمانون", "إذا انتهت علاقة العمل وجب على صاحب العمل أن يدفع إلى العامل مكافأة عن مدة خدمته..."),
}


@pytest.fixture(scope="session", autouse=True)
def seed_knowledge_base():
    with SessionLocal.begin() as db:
        if db.scalar(select(LegalSource).where(LegalSource.code == "LABOR_LAW")) is None:
            source = LegalSource(
                code="LABOR_LAW", name_ar="نظام العمل", legal_level="law", authority="test", collected_on=date(2026, 10, 3)
            )
            db.add(source)
            for i, (rid, (num, title, body)) in enumerate(ARTICLES.items()):
                db.add(
                    LegalProvision(
                        record_id=rid, source=source, content_type="مادة", article_number=num, sort_order=i,
                        title_ar=title, text_ar=body, status="in_force", text_hash=rid,
                    )
                )


@pytest.fixture
def client():
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE users, cases RESTART IDENTITY CASCADE"))
    from app.api import app

    return TestClient(app)


def _search_result(rid: str) -> SearchResult:
    num, title, body = ARTICLES[rid]
    return SearchResult(
        provision_id=0, record_id=rid, source_code="LABOR_LAW", source_name="نظام العمل", article_number=num,
        title=title, hierarchy=None, text=body, status="in_force", status_note=None, score=1.0, matched_by="vector",
    )


class FakeGemini:
    """Records what would have been sent to Gemini and returns canned answers."""

    def __init__(self):
        self.prompts: list[str] = []

    def analysis(self, prompt, **_):
        self.prompts.append(prompt if isinstance(prompt, str) else str(prompt))
        return LLMAnalysis(
            title="فصل [EMPLOYEE_1] دون سبب",
            facts_summary="عمل [EMPLOYEE_1] لدى [EMPLOYER_1] ست سنوات ثم فُصل دون سبب.",
            legal_issues=["الإنهاء لسبب غير مشروع"],
            applicable_articles=[
                CitedArticle(record_id="LAW-0077", why="تعويض الإنهاء غير المشروع"),
                CitedArticle(record_id="LAW-0084", why="مكافأة نهاية الخدمة"),
            ],
            analysis="يستحق [EMPLOYEE_1] التعويض والمكافأة.",
            missing_information=[],
            expected_outcome=ExpectedOutcome(summary="إلزام [EMPLOYER_1] بالدفع", likelihood="مرتفع", reasoning="م77 وم84"),
            recommended_steps=["التسوية الودية"],
            entitlements=[
                EntitlementInputs(kind="end_of_service", monthly_wage=10000, service_years=6),
                EntitlementInputs(kind="unlawful_termination_compensation", monthly_wage=10000, contract_type="indefinite", service_years=6),
            ],
        ), "fake-model"

    def claim(self, prompt, **_):
        self.prompts.append(prompt)
        return LLMClaim(
            subject="مطالبة بمستحقات عمالية",
            facts=["عمل [EMPLOYEE_1] لدى [EMPLOYER_1] ست سنوات.", "أنهى [EMPLOYER_1] العقد دون سبب مشروع."],
            legal_grounds=[
                LLMClaimGround(record_id="LAW-0077", argument="الإنهاء غير مشروع"),
                LLMClaimGround(record_id="LAW-9999", argument="مادة مخترعة"),
            ],
            requests=[
                LLMClaimRequest(kind="end_of_service", text="إلزام المدعى عليه بدفع مكافأة نهاية الخدمة"),
                LLMClaimRequest(kind="unlawful_termination_compensation", text="إلزام المدعى عليه بالتعويض"),
                LLMClaimRequest(kind="other", text="إلزام المدعى عليه بتسليم شهادة الخدمة"),
            ],
        ), "fake-model"

    def ocr(self, contents, **_):
        self.prompts.append("OCR")
        return "عقد عمل بين شركة النخبة المتحدة والسيد خالد", "fake-model"


@pytest.fixture
def gemini(monkeypatch):
    fake = FakeGemini()
    monkeypatch.setattr(analysis, "generate", fake.analysis)
    monkeypatch.setattr(analysis, "search", lambda q, k=8: [_search_result(r) for r in ARTICLES])
    monkeypatch.setattr(analysis, "expand", lambda results: results)
    monkeypatch.setattr(claim, "generate", fake.claim)
    monkeypatch.setattr(documents, "generate", fake.ocr)
    return fake


def register(client, username="khaled", password="password123", email=None):
    r = client.post("/api/auth/register", json={"username": username, "email": email or f"{username}@example.com", "password": password})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


CASE = {
    "description": "اسمي خالد سعد الغامدي، رقم هويتي 1087654321، جوالي 0551234567. أعمل في شركة الريادة للمقاولات منذ 6 سنوات وفصلت دون سبب.",
    "employee_name": "خالد سعد الغامدي",
    "employee_gender": "male",
}
