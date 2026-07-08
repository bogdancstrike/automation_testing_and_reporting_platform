"""add schedule tests

Revision ID: b6827e9b4cf8
Revises: a9d7c5e2b104
Create Date: 2026-07-07 22:35:00.000000

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b6827e9b4cf8"
down_revision: Union[str, Sequence[str], None] = "a9d7c5e2b104"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "schedule_tests",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("schedule_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("scenario_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["schedule_id"], ["schedules.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scenario_id"], ["scenarios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("schedule_id", "scenario_id", name="uq_schedule_tests_schedule_test"),
    )
    op.create_index("ix_schedule_tests_schedule_id", "schedule_tests", ["schedule_id"], unique=False)
    op.create_index("ix_schedule_tests_scenario_id", "schedule_tests", ["scenario_id"], unique=False)
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, scenario_id FROM schedules WHERE scenario_id IS NOT NULL")
    ).mappings()
    for row in rows:
        conn.execute(
            sa.text(
                """
                INSERT INTO schedule_tests (id, schedule_id, scenario_id)
                VALUES (:id, :schedule_id, :scenario_id)
                ON CONFLICT DO NOTHING
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "schedule_id": row["id"],
                "scenario_id": row["scenario_id"],
            },
        )


def downgrade() -> None:
    op.drop_index("ix_schedule_tests_scenario_id", table_name="schedule_tests")
    op.drop_index("ix_schedule_tests_schedule_id", table_name="schedule_tests")
    op.drop_table("schedule_tests")
