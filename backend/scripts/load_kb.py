"""Load the legal knowledge base into PostgreSQL.

Reads:
  data/kb/QISTAS_Legal_Knowledge_Base_RAG.jsonl   the provisions
  data/kb/sources.json                            metadata per source document
  data/kb/status_notes.json                       repealed / merged articles

Safe to run repeatedly: provisions are matched by record_id, and a provision's
chunks are rebuilt only when its text changed (so existing embeddings are kept).

Usage (from backend/):  uv run python -m scripts.load_kb
"""
import hashlib
import json
import re
from datetime import date

from sqlalchemy import select

from app.arabic import normalize
from app.chunking import build_header, split_text
from app.config import DATA_DIR
from app.db import SessionLocal
from app.models import LegalProvision, LegalSource, ProvisionChunk

KB_FILE = DATA_DIR / "kb" / "QISTAS_Legal_Knowledge_Base_RAG.jsonl"
SOURCES_FILE = DATA_DIR / "kb" / "sources.json"
STATUS_FILE = DATA_DIR / "kb" / "status_notes.json"

STATUS_LABELS = {"repealed": "ملغاة", "merged": "مدمجة في مادة أخرى"}
RECORD_PREFIX = {"LABOR_LAW": "LAW", "IMPL_REG": "REG"}


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def split_list(value: str) -> list[str]:
    return [v.strip() for v in re.split(r"[،,;|]", value or "") if v.strip()]


def leading_number(article_number: str | None) -> int:
    match = re.match(r"\d+", article_number or "")
    return int(match.group()) if match else 0


def upsert_sources(session, sources_meta: dict) -> dict[str, LegalSource]:
    by_group = {}
    for group, meta in sources_meta.items():
        source = session.scalar(select(LegalSource).where(LegalSource.code == meta["code"]))
        if source is None:
            source = LegalSource(code=meta["code"])
            session.add(source)
        source.name_ar = meta["name_ar"]
        source.legal_level = meta["legal_level"]
        source.authority = meta["authority"]
        source.issuing_instrument = meta.get("issuing_instrument")
        source.source_url = meta.get("source_url")
        source.collected_on = date.fromisoformat(meta["collected_on"])
        source.priority = meta.get("priority", "core")
        by_group[group] = source
    session.flush()
    return by_group


def provision_rows(sources_meta: dict, status_notes: dict) -> list[dict]:
    """Normalise the JSONL records and the status notes into one list of rows."""
    rows = []
    with open(KB_FILE, encoding="utf-8") as f:
        for line_no, line in enumerate(f):
            if not line.strip():
                continue
            r = json.loads(line)
            rows.append(
                {
                    "group": r["source_group"],
                    "record_id": r["record_id"],
                    "content_type": r["content_type"],
                    "article_number": r["article_or_item_id"] or None,
                    "sort_order": line_no,
                    "title_ar": r["title_ar"],
                    "hierarchy": r["hierarchy_full"] or None,
                    "text_ar": r["text_ar"].strip(),
                    "keywords": split_list(r["keywords"]),
                    "related_record_ids": split_list(r["related_law_record_ids"]),
                    "status": "in_force",
                    "status_note": None,
                    "page_start": r["source_page_start"],
                    "page_end": r["source_page_end"],
                }
            )

    # Stub provisions for repealed / merged articles, so "what does article 210
    # say?" gets a correct answer instead of nothing.
    for group, info in status_notes.items():
        if group.startswith("_"):
            continue
        prefix = RECORD_PREFIX[sources_meta[group]["code"]]
        for art in info["articles"]:
            n = art["article_number"]
            label = STATUS_LABELS[art["status"]]
            rows.append(
                {
                    "group": group,
                    "record_id": f"{prefix}-{int(n):04d}-{art['status'].upper()}",
                    "content_type": "مادة",
                    "article_number": n,
                    "sort_order": 0,
                    "title_ar": f"المادة ({n})",
                    "hierarchy": None,
                    "text_ar": f"المادة ({n}) من {group}: {label}. {art['note']}",
                    "keywords": [],
                    "related_record_ids": [],
                    "status": art["status"],
                    "status_note": art["note"],
                    "page_start": None,
                    "page_end": None,
                }
            )

    for row in rows:
        # The KB file writes "bis" articles (e.g. المادة الحادية عشرة مكرر) as "11.1".
        bis = re.fullmatch(r"(\d+)\.(\d+)", row["article_number"] or "")
        if bis and "مكرر" in row["title_ar"]:
            row["article_number"] = f"{bis.group(1)} مكرر" + (f" {bis.group(2)}" if bis.group(2) != "1" else "")

    # Sort-order inside a source follows the article number where there is one.
    for row in rows:
        if row["article_number"] and row["content_type"] == "مادة":
            bis = re.search(r"مكرر\s*(\d*)", row["article_number"])
            bis_offset = 4 + int(bis.group(1) or 1) if bis else 0  # 11 -> 110, 11 مكرر -> 115, مكرر 2 -> 116
            row["sort_order"] = leading_number(row["article_number"]) * 10 + bis_offset
        else:
            row["sort_order"] = 100_000 + row["sort_order"]
    return rows


def main() -> None:
    sources_meta = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))["sources"]
    status_notes = json.loads(STATUS_FILE.read_text(encoding="utf-8"))
    rows = provision_rows(sources_meta, status_notes)

    created = updated = unchanged = 0
    with SessionLocal.begin() as session:
        sources = upsert_sources(session, sources_meta)
        existing = {p.record_id: p for p in session.scalars(select(LegalProvision))}

        for row in rows:
            source = sources[row.pop("group")]
            text_hash = sha256(row["text_ar"])
            provision = existing.get(row["record_id"])

            if provision is None:
                provision = LegalProvision(source=source, text_hash=text_hash, **row)
                session.add(provision)
                created += 1
            elif provision.text_hash != text_hash or provision.title_ar != row["title_ar"]:
                for key, value in row.items():
                    setattr(provision, key, value)
                provision.source = source
                provision.text_hash = text_hash
                provision.chunks.clear()  # text changed -> rebuild chunks/embeddings
                updated += 1
            else:
                for key in (
                    "article_number", "status", "status_note", "keywords", "related_record_ids", "sort_order"
                ):
                    setattr(provision, key, row[key])
                unchanged += 1

            if not provision.chunks:
                header = build_header(
                    source.name_ar,
                    provision.title_ar,
                    provision.hierarchy,
                    STATUS_LABELS.get(provision.status),
                )
                provision.chunks = [
                    ProvisionChunk(chunk_index=i, retrieval_text=f"{header}\nالنص: {body}")
                    for i, body in enumerate(split_text(provision.text_ar))
                ]
            for chunk in provision.chunks:
                if chunk.search_text is None:
                    chunk.search_text = normalize(chunk.retrieval_text)

    print(f"provisions: {created} created, {updated} updated, {unchanged} unchanged")


if __name__ == "__main__":
    main()
