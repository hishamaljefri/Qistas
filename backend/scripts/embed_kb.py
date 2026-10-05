"""Compute Gemini embeddings for every chunk that doesn't have one yet.

Resumable: progress is committed after each batch, and only chunks with
embedding IS NULL are processed, so re-running continues where it stopped.

Usage (from backend/):  uv run python -m scripts.embed_kb
"""
from sqlalchemy import select

from app.db import SessionLocal
from app.embeddings import EMBEDDING_MODEL, embed_documents
from app.models import ProvisionChunk


def main() -> None:
    with SessionLocal() as session:
        chunks = session.scalars(
            select(ProvisionChunk).where(ProvisionChunk.embedding.is_(None)).order_by(ProvisionChunk.id)
        ).all()
        if not chunks:
            print("all chunks already embedded")
            return

        print(f"embedding {len(chunks)} chunks with {EMBEDDING_MODEL}...")
        texts = [c.retrieval_text for c in chunks]
        for start, vectors in embed_documents(texts):
            for chunk, vector in zip(chunks[start : start + len(vectors)], vectors):
                chunk.embedding = vector
                chunk.embedding_model = EMBEDDING_MODEL
            session.commit()
            print(f"  {start + len(vectors)}/{len(chunks)}")
    print("done")


if __name__ == "__main__":
    main()
