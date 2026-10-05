"""Database tables for the legal knowledge base.

legal_sources      one row per legal document (the Labor Law, its Implementing
                   Regulations, each annex). Records where/when it was collected.
legal_provisions   one row per article / item, with its legal status
                   (in force, repealed, merged into another article).
provision_chunks   the searchable pieces of each provision. Short provisions
                   are one chunk; long ones are split. Embeddings live here.
cases              a case description submitted by a user, stored MASKED only
                   (names / IDs replaced by placeholders; originals never stored).
case_analyses      each AI analysis of a case: what was retrieved, which model
                   answered, the structured result and how long it took.
"""
from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import EMBEDDING_DIM
from app.db import Base


class LegalSource(Base):
    __tablename__ = "legal_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)  # e.g. LABOR_LAW
    name_ar: Mapped[str] = mapped_column(Text)
    legal_level: Mapped[str] = mapped_column(String(20))  # law | regulation | annex | guidance
    authority: Mapped[str] = mapped_column(Text)
    issuing_instrument: Mapped[str | None] = mapped_column(Text)  # e.g. royal decree number
    source_url: Mapped[str | None] = mapped_column(Text)
    # Date the text was collected/verified. The app shows this as
    # "knowledge base up to date as of ...".
    collected_on: Mapped[date] = mapped_column(Date)
    priority: Mapped[str] = mapped_column(String(10), default="core")  # core | secondary
    notes: Mapped[str | None] = mapped_column(Text)

    provisions: Mapped[list["LegalProvision"]] = relationship(back_populates="source")


class LegalProvision(Base):
    __tablename__ = "legal_provisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    record_id: Mapped[str] = mapped_column(String(40), unique=True)  # e.g. LAW-0077
    source_id: Mapped[int] = mapped_column(ForeignKey("legal_sources.id"), index=True)
    content_type: Mapped[str] = mapped_column(String(60))  # مادة | جدول مخالفات | محتوى نموذج ...
    article_number: Mapped[str | None] = mapped_column(String(20), index=True)
    sort_order: Mapped[int] = mapped_column(Integer)
    title_ar: Mapped[str] = mapped_column(Text)
    hierarchy: Mapped[str | None] = mapped_column(Text)  # الباب | الفصل
    text_ar: Mapped[str] = mapped_column(Text)
    keywords: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    related_record_ids: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    status: Mapped[str] = mapped_column(String(20), default="in_force")  # in_force | repealed | merged
    status_note: Mapped[str | None] = mapped_column(Text)  # which decree repealed/merged it
    page_start: Mapped[int | None] = mapped_column(Integer)
    page_end: Mapped[int | None] = mapped_column(Integer)
    text_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    source: Mapped[LegalSource] = relationship(back_populates="provisions")
    chunks: Mapped[list["ProvisionChunk"]] = relationship(
        back_populates="provision", cascade="all, delete-orphan", order_by="ProvisionChunk.chunk_index"
    )


class ProvisionChunk(Base):
    __tablename__ = "provision_chunks"
    __table_args__ = (
        UniqueConstraint("provision_id", "chunk_index"),
        Index(
            "ix_provision_chunks_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        Index("ix_provision_chunks_search_tsv", "search_tsv", postgresql_using="gin"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    provision_id: Mapped[int] = mapped_column(
        ForeignKey("legal_provisions.id", ondelete="CASCADE"), index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer)
    # Text that gets embedded and searched: a short header (source, article,
    # chapter) followed by the chunk body, so each chunk is understandable alone.
    retrieval_text: Mapped[str] = mapped_column(Text)
    # Normalized Arabic (app.arabic.normalize) of retrieval_text, for keyword search.
    search_text: Mapped[str | None] = mapped_column(Text)
    search_tsv: Mapped[str | None] = mapped_column(
        TSVECTOR, Computed("to_tsvector('arabic', coalesce(search_text, ''))", persisted=True)
    )
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))
    embedding_model: Mapped[str | None] = mapped_column(String(100))

    provision: Mapped[LegalProvision] = relationship(back_populates="chunks")


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    masked_description: Mapped[str] = mapped_column(Text)
    pii_counts: Mapped[dict] = mapped_column(JSONB, default=dict)  # e.g. {"NATIONAL_ID": 1}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    analyses: Mapped[list["CaseAnalysis"]] = relationship(
        back_populates="case", cascade="all, delete-orphan", order_by="CaseAnalysis.id"
    )


class CaseAnalysis(Base):
    __tablename__ = "case_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    prompt_version: Mapped[str] = mapped_column(String(20))
    model_requested: Mapped[str] = mapped_column(String(100))
    model_version: Mapped[str | None] = mapped_column(String(100))  # concrete model Gemini used
    retrieved_record_ids: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    result: Mapped[dict] = mapped_column(JSONB)  # masked; same shape as schemas.LLMAnalysis
    grounding_warnings: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    latency_ms: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    case: Mapped[Case] = relationship(back_populates="analyses")
