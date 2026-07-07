"""add run actor and reset metadata

Revision ID: a9d7c5e2b104
Revises: f75e28049482
Create Date: 2026-07-07 19:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9d7c5e2b104"
down_revision: Union[str, Sequence[str], None] = "f75e28049482"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("test_runs", sa.Column("triggered_by", sa.String(length=120), nullable=True))
    op.add_column("test_runs", sa.Column("stats_reset_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("test_runs", sa.Column("stats_reset_by", sa.String(length=120), nullable=True))
    op.add_column("test_runs", sa.Column("stats_reset_reason", sa.Text(), nullable=True))
    op.create_index("ix_test_runs_triggered_by", "test_runs", ["triggered_by"], unique=False)
    op.create_index("ix_test_runs_stats_reset_at", "test_runs", ["stats_reset_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_test_runs_stats_reset_at", table_name="test_runs")
    op.drop_index("ix_test_runs_triggered_by", table_name="test_runs")
    op.drop_column("test_runs", "stats_reset_reason")
    op.drop_column("test_runs", "stats_reset_by")
    op.drop_column("test_runs", "stats_reset_at")
    op.drop_column("test_runs", "triggered_by")
