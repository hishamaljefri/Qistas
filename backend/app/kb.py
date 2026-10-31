"""Building a provision's search chunks and embedding them.

Shared by scripts/load_kb.py (loading the whole knowledge base) and app/routes/law.py (a data manager
editing or adding one article in the website), so both produce exactly the same searchable text.
"""
import hashlib
import logging

from app.arabic import normalize
from app.chunking import build_header, split_text
from app.embeddings import EMBEDDING_MODEL, embed_documents
from app.models import LegalProvision, ProvisionChunk

log = logging.getLogger("qistas")

STATUS_LABELS = {"repealed": "ملغاة", "merged": "مدمجة في مادة أخرى"}


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def build_chunks(provision: LegalProvision, source_name: str) -> list[ProvisionChunk]:
    """Header (source, title, chapter, status) + body, split if long. Embeddings are added separately."""
    header = build_header(source_name, provision.title_ar, provision.hierarchy, STATUS_LABELS.get(provision.status))
    chunks = []
    for i, body in enumerate(split_text(provision.text_ar)):
        retrieval_text = f"{header}\nالنص: {body}"
        chunks.append(ProvisionChunk(chunk_index=i, retrieval_text=retrieval_text, search_text=normalize(retrieval_text)))
    return chunks


def embed_chunks(chunks: list[ProvisionChunk]) -> bool:
    """Embed chunks in place. Returns False if Gemini is unavailable: the chunks are still saved and
    found by keyword search, and `scripts.embed_kb` (or the re-index button) embeds them later."""
    try:
        for start, vectors in embed_documents([c.retrieval_text for c in chunks]):
            for chunk, vector in zip(chunks[start : start + len(vectors)], vectors):
                chunk.embedding = vector
                chunk.embedding_model = EMBEDDING_MODEL
    except Exception as e:  # network, quota or API errors
        log.warning("embedding failed, chunks saved without vectors: %s", e)
        return False
    return True
