"""keyword search column

Revision ID: b58424a6e178
Revises: 0837eff58b0e
Create Date: 2026-10-03 18:07:35.626958

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import pgvector.sqlalchemy


# revision identifiers, used by Alembic.
revision: str = 'b58424a6e178'
down_revision: Union[str, Sequence[str], None] = '0837eff58b0e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("provision_chunks", sa.Column("search_text", sa.Text(), nullable=True))
    op.execute(
        "ALTER TABLE provision_chunks ADD COLUMN search_tsv tsvector "
        "GENERATED ALWAYS AS (to_tsvector('arabic', coalesce(search_text, ''))) STORED"
    )
    op.create_index(
        "ix_provision_chunks_search_tsv", "provision_chunks", ["search_tsv"], postgresql_using="gin"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_provision_chunks_search_tsv", table_name="provision_chunks")
    op.drop_column("provision_chunks", "search_tsv")
    op.drop_column("provision_chunks", "search_text")
