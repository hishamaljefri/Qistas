"""Text -> vector embeddings using the Gemini API (gemini-embedding-001).

Documents (law chunks) and queries (user questions) use different task types,
which Gemini optimizes for retrieval. Rate-limit errors (HTTP 429) on the free
tier are retried with increasing waits instead of failing.
"""
from functools import lru_cache

from google.genai import types

from app.config import EMBEDDING_DIM
from app.gemini import get_client, with_retry

EMBEDDING_MODEL = "gemini-embedding-001"
BATCH_SIZE = 50


def _embed(texts: list[str], task_type: str) -> list[list[float]]:
    config = types.EmbedContentConfig(task_type=task_type, output_dimensionality=EMBEDDING_DIM)
    result = with_retry(
        lambda: get_client().models.embed_content(model=EMBEDDING_MODEL, contents=texts, config=config)
    )
    return [e.values for e in result.embeddings]


def embed_documents(texts: list[str]):
    """Yield (start_index, vectors) per batch, so callers can save progress as they go."""
    for start in range(0, len(texts), BATCH_SIZE):
        yield start, _embed(texts[start : start + BATCH_SIZE], "RETRIEVAL_DOCUMENT")


@lru_cache(maxsize=512)
def embed_query(text: str) -> list[float]:
    # Called during a user request: retry briefly rather than making the user wait minutes.
    config = types.EmbedContentConfig(task_type="RETRIEVAL_QUERY", output_dimensionality=EMBEDDING_DIM)
    result = with_retry(
        lambda: get_client().models.embed_content(model=EMBEDDING_MODEL, contents=[text], config=config),
        max_retries=3,
        first_wait=3,
    )
    return result.embeddings[0].values
