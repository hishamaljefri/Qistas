"""Hybrid search over the legal knowledge base.

1. Explicit article references ("المادة 77") are looked up directly.
2. Semantic search: question embedding vs chunk embeddings (pgvector cosine).
3. Keyword search: Postgres Arabic full-text on normalized text.
"hybrid" (the default) = 1 + 2. Keyword search lowered accuracy at every fusion
weight tried on data/eval (see scripts/eval_retrieval.py), so it is kept as a
separate mode for exact-phrase lookups rather than mixed into the default.
Rankings are combined with Reciprocal Rank Fusion (RRF) and grouped per provision.
Repealed / merged articles are only returned when asked for by number.
Violations-table rows (fines, decision 112377) rank below the law like other secondary
sources, unless the question asks about a fine or penalty: then a violations-only ranking
is fused in as well, and Labor Law article 229 (the penalties article) is always included.
"""
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import Text, cast, func, select

from app.arabic import find_article_numbers, normalize
from app.db import SessionLocal
from app.embeddings import embed_query
from app.models import LegalProvision, LegalSource, ProvisionChunk

Mode = Literal["hybrid", "vector", "keyword"]

CANDIDATES = 30  # how many chunks each method contributes before fusion
RRF_K = 60
SECONDARY_SOURCE_WEIGHT = 0.6  # annexes and the violations table rank below the law / regulations
VIOLATIONS_CODE = "VIOLATIONS_112377"
# Normalized word stems showing the question is about the penalty itself (غرامة، عقوبة، مخالفة، يغرم، جزاء).
_PENALTY_STEMS = ("غرام", "عقوب", "مخالف", "يغرم", "جزاء")
# Labor Law article that the table's fines rest on (penalties for breaking the Law); shown with them.
PENALTY_BASIS_ARTICLE = "229"
# Table sections that apply to one sector only (record ids VIO-<code>-NNN). Their rows are used only
# when the question mentions that sector; otherwise e.g. "keeps my passport" would match the
# agricultural-workers row instead of the general one. Words are given in normalized form.
SECTOR_SECTIONS = {
    "B": ("منجم", "مناجم", "محجر", "محاجر"),
    "C": ("بحار", "بحري", "سفينه", "سفن"),
    "J": ("منزلي", "منزليه", "خادمه", "سايق خاص", "عامله منزل"),
    "K": ("زراع", "مزرعه", "رعاه", "راعي", "رعوي"),
}

# Question words that carry no legal meaning; dropped from the keyword query.
_STOPWORDS = {
    normalize(w)
    for w in "ما ماذا هل كيف كم متى لماذا اين من في على عن الى إلى او أو و ثم اذا إذا اذ هو هي هم انا أنا لي لدي عندي "
    "هذا هذه ذلك التي الذي لا لم لن ان أن إن كان كانت يكون مع بعد قبل عند حتى كل اي أي بين وش ايش ليش "
    "حسب النظام نظام العمل المادة ماده".split()
}


@dataclass
class SearchResult:
    provision_id: int
    record_id: str
    source_code: str
    source_name: str
    article_number: str | None
    title: str
    hierarchy: str | None
    text: str
    status: str
    status_note: str | None
    score: float
    matched_by: str  # "article_number" | "vector" | "keyword" | "vector+keyword"


def _keyword_query(question: str) -> str:
    words = [w for w in normalize(question).replace("؟", " ").split() if w not in _STOPWORDS and len(w) > 1]
    return " ".join(words)


def asks_about_penalties(question: str) -> bool:
    text = normalize(question)
    return any(stem in text for stem in _PENALTY_STEMS)


def other_sector_prefixes(question: str) -> list[str]:
    """Record-id prefixes of sector sections the question does not mention (their rows are skipped)."""
    text = normalize(question)
    return [f"VIO-{code}-" for code, words in SECTOR_SECTIONS.items() if not any(w in text for w in words)]


def _vector_ranking(session, question: str, source_code: str | None = None) -> list[int]:
    vector = embed_query(question)  # cached: a second ranking for the same question costs no API call
    query = (
        select(ProvisionChunk.id)
        .join(LegalProvision)
        .join(LegalSource)
        .where(LegalProvision.status == "in_force", ProvisionChunk.embedding.is_not(None))
    )
    for prefix in other_sector_prefixes(question):
        query = query.where(~LegalProvision.record_id.startswith(prefix))
    if source_code:
        query = query.where(LegalSource.code == source_code)
    rows = session.execute(query.order_by(ProvisionChunk.embedding.cosine_distance(vector)).limit(CANDIDATES))
    return [r[0] for r in rows]


def _keyword_ranking(session, question: str) -> list[int]:
    query_text = _keyword_query(question)
    if not query_text:
        return []
    # OR the stemmed words together: a question rarely shares every word with the law text.
    ts_query = func.to_tsquery(
        "arabic", func.replace(cast(func.plainto_tsquery("arabic", query_text), Text), "&", "|")
    )
    rank = func.ts_rank_cd(ProvisionChunk.search_tsv, ts_query)
    rows = session.execute(
        select(ProvisionChunk.id)
        .join(LegalProvision)
        .where(LegalProvision.status == "in_force", ProvisionChunk.search_tsv.op("@@")(ts_query))
        .order_by(rank.desc())
        .limit(CANDIDATES)
    )
    return [r[0] for r in rows]


def _to_result(provision: LegalProvision, score: float, matched_by: str) -> SearchResult:
    return SearchResult(
        provision_id=provision.id,
        record_id=provision.record_id,
        source_code=provision.source.code,
        source_name=provision.source.name_ar,
        article_number=provision.article_number,
        title=provision.title_ar,
        hierarchy=provision.hierarchy,
        text=provision.text_ar,
        status=provision.status,
        status_note=provision.status_note,
        score=round(score, 5),
        matched_by=matched_by,
    )


def search(question: str, k: int = 5, mode: Mode = "hybrid") -> list[SearchResult]:
    with SessionLocal() as session:
        results: list[SearchResult] = []

        # 1. explicit article numbers -> the Labor Law article itself, first.
        numbers = find_article_numbers(question) if mode == "hybrid" else []
        if numbers:
            provisions = session.scalars(
                select(LegalProvision)
                .join(LegalSource)
                .where(LegalSource.code == "LABOR_LAW", LegalProvision.article_number.in_([str(n) for n in numbers]))
            ).all()
            results += [_to_result(p, 1.0, "article_number") for p in provisions]

        # 2 + 3. semantic and keyword rankings, fused.
        rankings: dict[str, list[int]] = {}
        penalty_question = mode in ("hybrid", "vector") and asks_about_penalties(question)
        if mode in ("hybrid", "vector"):
            rankings["vector"] = _vector_ranking(session, question)
        if penalty_question:
            rankings["violations"] = _vector_ranking(session, question, VIOLATIONS_CODE)
        if mode == "keyword":
            rankings["keyword"] = _keyword_ranking(session, question)

        chunk_scores: dict[int, float] = {}
        chunk_methods: dict[int, set[str]] = {}
        for method, chunk_ids in rankings.items():
            for rank, chunk_id in enumerate(chunk_ids):
                chunk_scores[chunk_id] = chunk_scores.get(chunk_id, 0.0) + 1.0 / (RRF_K + rank + 1)
                chunk_methods.setdefault(chunk_id, set()).add(method)

        if chunk_scores:
            chunks = session.scalars(select(ProvisionChunk).where(ProvisionChunk.id.in_(chunk_scores))).all()
            best: dict[int, tuple[float, ProvisionChunk]] = {}
            for chunk in chunks:
                score = chunk_scores[chunk.id]
                source = chunk.provision.source
                if source.priority != "core" and not (penalty_question and source.code == VIOLATIONS_CODE):
                    score *= SECONDARY_SOURCE_WEIGHT
                if chunk.provision_id not in best or score > best[chunk.provision_id][0]:
                    best[chunk.provision_id] = (score, chunk)

            already = {r.provision_id for r in results}
            for score, chunk in sorted(best.values(), key=lambda x: -x[0]):
                if chunk.provision_id in already:
                    continue
                matched_by = "+".join(sorted(chunk_methods[chunk.id]))
                results.append(_to_result(chunk.provision, score, matched_by))
                if len(results) >= k:
                    break

        results = results[:k]
        if penalty_question and not any(
            r.source_code == "LABOR_LAW" and r.article_number == PENALTY_BASIS_ARTICLE for r in results
        ):
            basis = session.scalar(
                select(LegalProvision)
                .join(LegalSource)
                .where(LegalSource.code == "LABOR_LAW", LegalProvision.article_number == PENALTY_BASIS_ARTICLE)
            )
            if basis is not None:
                # first for a general question ("ما عقوبة مخالفة النظام؟"), second when a table row is closer
                first = _distance(session, question, LegalProvision.id == basis.id) <= _distance(
                    session, question, LegalSource.code == VIOLATIONS_CODE
                )
                results.insert(0 if first else min(1, len(results)), _to_result(basis, 0.0, "penalty_basis"))
        return results[:k]


def _distance(session, question: str, condition) -> float:
    """Smallest cosine distance between the question and the chunks matching `condition`."""
    vector = embed_query(question)
    query = select(func.min(ProvisionChunk.embedding.cosine_distance(vector))).join(LegalProvision).join(LegalSource).where(condition)
    for prefix in other_sector_prefixes(question):
        query = query.where(~LegalProvision.record_id.startswith(prefix))
    distance = session.scalar(query)
    return 2.0 if distance is None else distance


def search_violations(question: str, k: int = 2) -> list[SearchResult]:
    """The violations-table rows closest to a case, so the analysis can mention the possible fine."""
    with SessionLocal() as session:
        chunk_ids = _vector_ranking(session, question, VIOLATIONS_CODE)[:k]
        chunks = {c.id: c for c in session.scalars(select(ProvisionChunk).where(ProvisionChunk.id.in_(chunk_ids)))}
        return [_to_result(chunks[i].provision, 0.0, "violations") for i in chunk_ids if i in chunks]
