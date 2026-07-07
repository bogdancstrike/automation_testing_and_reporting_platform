"""User comments attached to tests and runs."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class EntityComment(Base):
    __tablename__ = "entity_comments"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(UUID(as_uuid=False), index=True)
    entity_type: Mapped[str] = mapped_column(String(20), index=True)  # test | run
    entity_id: Mapped[str] = mapped_column(UUID(as_uuid=False), index=True)
    author: Mapped[str] = mapped_column(String(120), default="unknown")
    body: Mapped[str] = mapped_column(Text)
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
