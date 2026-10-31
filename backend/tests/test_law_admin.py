"""Law management (FR15, admin only): who may edit, what an edit does to search, and the change history.

Each test uses its own small source (TEST_LAW) so the shared test articles stay unchanged;
Gemini embeddings are faked.
"""
from datetime import date

import pytest
from sqlalchemy import delete, select, text

from app import kb
from app.config import EMBEDDING_DIM
from app.db import SessionLocal, engine
from app.models import LegalProvision, LegalSource, ProvisionChunk
from app.search import search
from conftest import register


def set_role(username: str, role: str) -> None:
    with engine.begin() as conn:
        conn.execute(text("UPDATE users SET role=:r WHERE username=:u"), {"r": role, "u": username})


@pytest.fixture
def law(client, monkeypatch):
    """A test source with one article; returns how many texts were sent for embedding per call."""
    calls: list[int] = []

    def fake_embed(texts):
        calls.append(len(texts))
        yield 0, [[0.01] * EMBEDDING_DIM for _ in texts]

    monkeypatch.setattr(kb, "embed_documents", fake_embed)
    with SessionLocal.begin() as db:
        source = LegalSource(code="TEST_LAW", name_ar="نظام تجريبي", legal_level="law", authority="test", collected_on=date(2026, 10, 31))
        db.add(source)
        db.add(
            LegalProvision(
                record_id="TST-0001", source=source, content_type="مادة", article_number="1", sort_order=10,
                title_ar="المادة الأولى", text_ar="للعامل إجازة زرقاء مدتها خمسة أيام.", status="in_force", text_hash="x",
            )
        )
    yield calls
    with SessionLocal.begin() as db:
        test_source = select(LegalSource.id).where(LegalSource.code == "TEST_LAW").scalar_subquery()
        db.execute(delete(LegalProvision).where(LegalProvision.source_id == test_source))
        db.execute(delete(LegalSource).where(LegalSource.code == "TEST_LAW"))


def admin(client, name="admin1"):
    headers = register(client, name)
    set_role(name, "admin")
    return headers


def chunks_of(record_id: str) -> list[ProvisionChunk]:
    with SessionLocal() as db:
        p = db.scalar(select(LegalProvision).where(LegalProvision.record_id == record_id))
        return [ProvisionChunk(retrieval_text=c.retrieval_text, embedding=c.embedding) for c in p.chunks]


def test_only_admins_manage_the_law(client, law):
    assert client.get("/api/law/provisions").status_code == 401
    user = register(client, "khaled")
    assert client.get("/api/law/provisions", headers=user).status_code == 403  # SR4
    assert client.patch("/api/law/provisions/TST-0001", json={"title": "عنوان", "reason": "محاولة تعديل"}, headers=user).status_code == 403
    assert client.get("/api/law/provisions", headers=admin(client)).status_code == 200


def test_edit_rebuilds_search_text_and_keeps_history(client, law):
    adm = admin(client)
    r = client.patch(
        "/api/law/provisions/TST-0001",
        json={"text": "للعامل إجازة زرقاء مدتها سبعة أيام.", "reason": "تعديل بالمرسوم الملكي م/99"},
        headers=adm,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["text"] == "للعامل إجازة زرقاء مدتها سبعة أيام." and body["searchable"] is True
    [rev] = body["history"]
    assert rev["action"] == "update" and rev["changed_by"] == "admin1" and rev["reason"] == "تعديل بالمرسوم الملكي م/99"
    assert rev["changes"] == {"text": ["للعامل إجازة زرقاء مدتها خمسة أيام.", "للعامل إجازة زرقاء مدتها سبعة أيام."]}

    [chunk] = chunks_of("TST-0001")
    assert "سبعة أيام" in chunk.retrieval_text and chunk.embedding is not None
    assert law == [1]  # one chunk embedded
    assert client.get("/api/provisions/TST-0001").json()["text"] == "للعامل إجازة زرقاء مدتها سبعة أيام."  # public page


def test_repealed_article_leaves_search(client, law):
    adm = admin(client)
    client.patch("/api/law/provisions/TST-0001", json={"title": "المادة الأولى (معدلة)", "reason": "تصحيح العنوان"}, headers=adm)
    assert any(r.record_id == "TST-0001" for r in search("إجازة زرقاء", k=5, mode="keyword"))

    r = client.patch(
        "/api/law/provisions/TST-0001",
        json={"status": "repealed", "status_note": "أُلغيت بالمرسوم م/100", "reason": "إلغاء بالمرسوم الملكي م/100"},
        headers=adm,
    )
    assert r.status_code == 200
    assert "الحالة: ملغاة" in chunks_of("TST-0001")[0].retrieval_text
    assert not any(r.record_id == "TST-0001" for r in search("إجازة زرقاء", k=5, mode="keyword"))
    assert len(r.json()["history"]) == 2


def test_edit_needs_a_reason_and_a_change(client, law):
    adm = admin(client)
    assert client.patch("/api/law/provisions/TST-0001", json={"status": "repealed"}, headers=adm).status_code == 422
    same = {"title": "المادة الأولى", "reason": "لا شيء تغيّر هنا"}
    assert client.patch("/api/law/provisions/TST-0001", json=same, headers=adm).status_code == 400
    empty = {"text": "     ", "reason": "نص فارغ"}
    assert client.patch("/api/law/provisions/TST-0001", json=empty, headers=adm).status_code == 422
    assert client.patch("/api/law/provisions/NOPE-1", json={"title": "عنوان", "reason": "غير موجودة"}, headers=adm).status_code == 404


def test_add_article(client, law):
    adm = admin(client)
    new = {"source_code": "TEST_LAW", "article_number": "2", "title": "المادة الثانية", "text": "نص مادة مضافة حديثاً عن العمل المرن.", "reason": "مادة جديدة بالمرسوم م/101"}
    r = client.post("/api/law/provisions", json=new, headers=adm)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["record_id"] == "TST-ADD-001" and body["searchable"] is True
    assert body["history"][0]["action"] == "create"
    assert client.post("/api/law/provisions", json=new, headers=adm).status_code == 409  # article 2 exists now

    page = client.get("/api/law/provisions", params={"source": "TEST_LAW", "q": "المرن"}, headers=adm).json()
    assert page["total"] == 1 and page["items"][0]["record_id"] == "TST-ADD-001" and page["items"][0]["revisions"] == 1
    sources = {s["code"]: s["provisions"] for s in client.get("/api/law/sources", headers=adm).json()}
    assert sources["TEST_LAW"] == 2


def test_saved_while_gemini_is_down_then_reindexed(client, law, monkeypatch):
    adm = admin(client)

    def down(texts):
        raise RuntimeError("503 overloaded")
        yield  # pragma: no cover

    monkeypatch.setattr(kb, "embed_documents", down)
    r = client.patch("/api/law/provisions/TST-0001", json={"text": "نص جديد للمادة الأولى.", "reason": "تعديل والخدمة متوقفة"}, headers=adm)
    assert r.status_code == 200 and r.json()["searchable"] is False  # saved, keyword search still finds it
    assert client.post("/api/law/provisions/TST-0001/reindex", headers=adm).status_code == 503

    monkeypatch.setattr(kb, "embed_documents", lambda texts: iter([(0, [[0.02] * EMBEDDING_DIM for _ in texts])]))
    r = client.post("/api/law/provisions/TST-0001/reindex", headers=adm)
    assert r.status_code == 200 and r.json()["searchable"] is True
