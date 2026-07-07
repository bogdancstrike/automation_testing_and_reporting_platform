"""Comment serializers."""
from __future__ import annotations

from typing import Any

from src.comments.models import EntityComment


def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


def comment(c: EntityComment) -> dict[str, Any]:
    return {
        "id": c.id,
        "project_id": c.project_id,
        "entity_type": c.entity_type,
        "entity_id": c.entity_id,
        "author": c.author,
        "body": c.body,
        "tags": c.tags or [],
        "created_at": _iso(c.created_at),
    }
