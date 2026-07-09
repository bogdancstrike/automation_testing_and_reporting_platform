"""Add trace_id to test_runs (Observability Bridge)

Revision ID: c3f1a7e9d820
Revises: 18f64b9f1371
Create Date: 2026-07-09 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f1a7e9d820'
down_revision: Union[str, Sequence[str], None] = '18f64b9f1371'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('test_runs', sa.Column('trace_id', sa.String(length=32), nullable=True))
    op.create_index('ix_test_runs_trace_id', 'test_runs', ['trace_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_test_runs_trace_id', table_name='test_runs')
    op.drop_column('test_runs', 'trace_id')
