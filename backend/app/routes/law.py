"""Law management (FR15): the admin keeps the knowledge base current from the website.

Editing an article's text, title or status rebuilds its search chunks and embeddings at once, so the
next search and analysis use the new version. Repealed / merged articles are left out of search
automatically (app.search only uses in-force provisions). Every change is kept in provision_revisions
with who made it, when, why, and the values before and after.
"""
import re
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.db import get_db
from app.kb import build_chunks, embed_chunks, text_hash
from app.models import LegalProvision, LegalSource, ProvisionRevision, User
from app.schemas import (
    LawPage,
    LawProvisionCreate,
    LawProvisionOut,
    LawProvisionUpdate,
    LawRevisionOut,
    LawRow,
    LawSourceOut,
)

router = APIRouter(prefix="/api/law", tags=["law management"])

# API field -> model column. Changing one of SEARCHED_FIELDS rebuilds the article's chunks.
FIELDS = {"title": "title_ar", "article_number": "article_number", "text": "text_ar", "status": "status", "status_note": "status_note"}
SEARCHED_FIELDS = {"title", "text", "status"}
OPTIONAL_FIELDS = {"article_number", "status_note"}  # "" clears them


def _provision(db: Session, record_id: str) -> LegalProvision:
    p = db.scalar(select(LegalProvision).where(LegalProvision.record_id == record_id))
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "المادة غير موجودة")
    return p


def _row(p: LegalProvision, revisions: int, last_changed_at) -> dict:
    return dict(
        record_id=p.record_id,
        source_code=p.source.code,
        source_name=p.source.name_ar,
        article_number=p.article_number,
        title=p.title_ar,
        status=p.status,
        revisions=revisions,
        last_changed_at=last_changed_at,
    )


def _detail(db: Session, p: LegalProvision) -> LawProvisionOut:
    history = db.scalars(
        select(ProvisionRevision).where(ProvisionRevision.provision_id == p.id).order_by(ProvisionRevision.id.desc())
    ).all()
    return LawProvisionOut(
        **_row(p, len(history), history[0].changed_at if history else None),
        content_type=p.content_type,
        hierarchy=p.hierarchy,
        text=p.text_ar,
        status_note=p.status_note,
        searchable=bool(p.chunks) and all(c.embedding is not None for c in p.chunks),
        history=[
            LawRevisionOut(action=h.action, changes=h.changes, reason=h.reason, changed_by=h.changed_by_name, changed_at=h.changed_at)
            for h in history
        ],
    )


def _reindex(db: Session, p: LegalProvision) -> None:
    """Replace the article's chunks (header + text) and embed them."""
    p.chunks.clear()
    db.flush()  # delete the old chunks before inserting new ones with the same chunk_index
    p.chunks = build_chunks(p, p.source.name_ar)
    embed_chunks(p.chunks)


@router.get("/sources", response_model=list[LawSourceOut])
def list_sources(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[LawSourceOut]:
    counts = dict(db.execute(select(LegalProvision.source_id, func.count()).group_by(LegalProvision.source_id)).all())
    return [
        LawSourceOut(code=s.code, name_ar=s.name_ar, provisions=counts.get(s.id, 0))
        for s in db.scalars(select(LegalSource).order_by(LegalSource.id))
    ]


@router.get("/provisions", response_model=LawPage)
def list_provisions(
    q: str = Query(default="", max_length=200, description="عنوان المادة أو رقمها أو كلمات من نصها"),
    source: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status", pattern="^(in_force|repealed|merged)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> LawPage:
    query = select(LegalProvision).join(LegalSource)
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.where(
            or_(
                LegalProvision.title_ar.ilike(like),
                LegalProvision.record_id.ilike(like),
                LegalProvision.article_number == q.strip(),
                LegalProvision.text_ar.ilike(like),
            )
        )
    if source:
        query = query.where(LegalSource.code == source)
    if status_filter:
        query = query.where(LegalProvision.status == status_filter)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    provisions = db.scalars(query.order_by(LegalSource.id, LegalProvision.sort_order, LegalProvision.id).limit(limit).offset(offset)).all()
    stats = {
        pid: (n, last)
        for pid, n, last in db.execute(
            select(ProvisionRevision.provision_id, func.count(), func.max(ProvisionRevision.changed_at))
            .where(ProvisionRevision.provision_id.in_([p.id for p in provisions]))
            .group_by(ProvisionRevision.provision_id)
        )
    }
    return LawPage(total=total, items=[LawRow(**_row(p, *stats.get(p.id, (0, None)))) for p in provisions])


@router.get("/provisions/{record_id}", response_model=LawProvisionOut)
def get_provision(record_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> LawProvisionOut:
    return _detail(db, _provision(db, record_id))


@router.patch("/provisions/{record_id}", response_model=LawProvisionOut)
def update_provision(
    record_id: str, req: LawProvisionUpdate, user: User = Depends(require_admin), db: Session = Depends(get_db)
) -> LawProvisionOut:
    p = _provision(db, record_id)
    changes: dict[str, list[str | None]] = {}
    for field in req.model_fields_set - {"reason"}:
        new = getattr(req, field)
        new = new.strip() if isinstance(new, str) else new
        if field in OPTIONAL_FIELDS:
            new = new or None
        elif not new:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "العنوان والنص والحالة لا يمكن أن تكون فارغة")
        old = getattr(p, FIELDS[field])
        if new != old:
            changes[field] = [old, new]
            setattr(p, FIELDS[field], new)
    if not changes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "لا يوجد تغيير لحفظه")
    if "text" in changes:
        p.text_hash = text_hash(p.text_ar)
    if changes.keys() & SEARCHED_FIELDS:
        _reindex(db, p)
    db.add(
        ProvisionRevision(
            provision=p, action="update", changes=changes, reason=req.reason.strip(), changed_by_id=user.id, changed_by_name=user.username
        )
    )
    db.commit()
    return _detail(db, p)


@router.post("/provisions", response_model=LawProvisionOut, status_code=status.HTTP_201_CREATED)
def create_provision(req: LawProvisionCreate, user: User = Depends(require_admin), db: Session = Depends(get_db)) -> LawProvisionOut:
    source = db.scalar(select(LegalSource).where(LegalSource.code == req.source_code))
    if source is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "المصدر غير موجود")
    number = (req.article_number or "").strip() or None
    if number:
        existing = db.scalar(
            select(LegalProvision).where(
                LegalProvision.source_id == source.id, LegalProvision.article_number == number, LegalProvision.status == "in_force"
            )
        )
        if existing is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, f"المادة {number} موجودة في هذا المصدر ({existing.record_id})؛ عدّلها بدلاً من إضافتها")

    siblings = db.execute(select(LegalProvision.record_id, LegalProvision.content_type, LegalProvision.sort_order).where(LegalProvision.source_id == source.id)).all()
    # follow the source's own naming (LAW-..., REG-..., APP1-...) and mark the article as added in the site
    prefix = Counter(r.record_id.split("-")[0] for r in siblings).most_common(1)[0][0] if siblings else source.code
    added = sum(1 for r in siblings if r.record_id.startswith(f"{prefix}-ADD-"))
    content_type = Counter(r.content_type for r in siblings).most_common(1)[0][0] if siblings else "مادة"
    leading = re.match(r"\d+", number or "")
    sort_order = int(leading.group()) * 10 if leading and content_type == "مادة" else max((r.sort_order for r in siblings), default=0) + 1

    p = LegalProvision(
        record_id=f"{prefix}-ADD-{added + 1:03d}",
        source=source,
        content_type=content_type,
        article_number=number,
        sort_order=sort_order,
        title_ar=req.title.strip(),
        hierarchy=(req.hierarchy or "").strip() or None,
        text_ar=req.text.strip(),
        keywords=[],
        related_record_ids=[],
        status=req.status,
        status_note=(req.status_note or "").strip() or None,
        text_hash=text_hash(req.text.strip()),
    )
    db.add(p)
    db.flush()
    p.chunks = build_chunks(p, source.name_ar)
    embed_chunks(p.chunks)
    created = {"title": p.title_ar, "article_number": p.article_number, "text": p.text_ar, "status": p.status, "status_note": p.status_note}
    db.add(
        ProvisionRevision(
            provision=p,
            action="create",
            changes={k: [None, v] for k, v in created.items() if v is not None},
            reason=req.reason.strip(),
            changed_by_id=user.id,
            changed_by_name=user.username,
        )
    )
    db.commit()
    return _detail(db, p)


@router.post("/provisions/{record_id}/reindex", response_model=LawProvisionOut)
def reindex_provision(record_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> LawProvisionOut:
    """Retry the embeddings of an article saved while Gemini was unavailable."""
    p = _provision(db, record_id)
    if not p.chunks:
        p.chunks = build_chunks(p, p.source.name_ar)
    missing = [c for c in p.chunks if c.embedding is None] or p.chunks  # nothing missing: embed again
    if not embed_chunks(missing):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "تعذّر الاتصال بخدمة Gemini الآن، حاول بعد قليل")
    db.commit()
    return _detail(db, p)
