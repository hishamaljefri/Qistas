"""Add legally related articles to the search results before they go to the LLM.

Two sources of links:
1. Companion rules (data/kb/companions.json): e.g. any termination article
   brings in the end-of-service award (art. 84), because users describe what
   happened ("fired me") rather than what they are owed.
2. Implementing regulations: each regulations article lists the Labor Law
   article it implements (legal_provisions.related_record_ids); when that law
   article is retrieved, its regulation is added for the procedural detail.
"""
import json
from functools import lru_cache

from sqlalchemy import select

from app.config import DATA_DIR
from app.db import SessionLocal
from app.models import LegalProvision, LegalSource
from app.search import SearchResult, _to_result

COMPANIONS_FILE = DATA_DIR / "kb" / "companions.json"
MAX_ADDED = 6
REGULATIONS_FOR_TOP = 3  # add implementing regulations for the top-N retrieved law articles


@lru_cache
def _rules() -> list[dict]:
    return json.loads(COMPANIONS_FILE.read_text(encoding="utf-8"))["rules"]


def expand(results: list[SearchResult]) -> list[SearchResult]:
    present = {r.record_id for r in results}
    law_numbers = [r.article_number for r in results if r.source_code == "LABOR_LAW" and r.status == "in_force"]

    wanted_articles: list[str] = []
    for rule in _rules():
        if set(rule["when_any"]) & set(law_numbers):
            wanted_articles += [a for a in rule["add"] if a not in law_numbers and a not in wanted_articles]

    top_law_ids = [
        r.record_id for r in results if r.source_code == "LABOR_LAW" and r.status == "in_force"
    ][:REGULATIONS_FOR_TOP]

    added: list[SearchResult] = []
    with SessionLocal() as session:
        if wanted_articles:
            rows = session.scalars(
                select(LegalProvision)
                .join(LegalSource)
                .where(
                    LegalSource.code == "LABOR_LAW",
                    LegalProvision.status == "in_force",
                    LegalProvision.article_number.in_(wanted_articles),
                )
            ).all()
            by_number = {p.article_number: p for p in rows}
            added += [_to_result(by_number[a], 0.0, "companion") for a in wanted_articles if a in by_number]

        if top_law_ids:
            regs = session.scalars(
                select(LegalProvision)
                .join(LegalSource)
                .where(LegalSource.code == "IMPL_REG", LegalProvision.related_record_ids.overlap(top_law_ids))
                .order_by(LegalProvision.sort_order)
            ).all()
            added += [_to_result(p, 0.0, "implementing_regulation") for p in regs]

    expanded = list(results)
    for r in added:
        if r.record_id in present:
            continue
        if len(expanded) - len(results) >= MAX_ADDED:
            break
        expanded.append(r)
        present.add(r.record_id)
    return expanded
