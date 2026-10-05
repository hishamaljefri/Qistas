"""Hybrid search over the legal knowledge base.

1. Explicit article references ("المادة 77") are looked up directly.
2. Semantic search: question embedding vs chunk embeddings (pgvector cosine).
3. Keyword search: Postgres Arabic full-text on normalized text.
"hybrid" (the default) = 1 + 2. Keyword search lowered accuracy at every fusion
weight tried on data/eval (see scripts/eval_retrieval.py), so it is kept as a
separate mode for exact-phrase lookups rather than mixed into the default.
Rankings are combined with Reciprocal Rank Fusion (RRF) and grouped per provision.
Repealed / merged articles are only returned when asked for by number.
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
SECONDARY_SOURCE_WEIGHT = 0.6  # annexes 2-5 rank below the law / regulations / annex 1

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


def _vector_ranking(session, question: str) -> list[int]:
    vector = embed_query(question)
    rows = session.execute(
        select(ProvisionChunk.id)
        .join(LegalProvision)
        .where(LegalProvision.status == "in_force", ProvisionChunk.embedding.is_not(None))
        .order_by(ProvisionChunk.embedding.cosine_distance(vector))
        .limit(CANDIDATES)
    )
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
        if mode in ("hybrid", "vector"):
            rankings["vector"] = _vector_ranking(session, question)
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
                if chunk.provision.source.priority != "core":
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

        return results[:k]
