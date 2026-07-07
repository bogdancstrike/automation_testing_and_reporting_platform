"""Reusable tags and comments for tests/runs."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.catalog.models import TestDefinition
from src.comments import serializers
from src.comments.models import EntityComment
from src.core.errors import NotFoundError, ValidationError
from src.execution.models import TestRun

_ENTITY_TYPES = {"test", "run"}


def _clean_tags(tags: list[Any] | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in tags or []:
        tag = str(raw).strip()
        if not tag or tag.lower() in seen:
            continue
        seen.add(tag.lower())
        out.append(tag)
    return out


def _entity_project(db: Session, entity_type: str, entity_id: str) -> str:
    if entity_type == "test":
        test = db.get(TestDefinition, entity_id)
        if not test:
            raise NotFoundError("test not found")
        return test.project_id
    if entity_type == "run":
        run = db.get(TestRun, entity_id)
        if not run:
            raise NotFoundError("run not found")
        return run.project_id
    raise ValidationError("entity_type must be test or run")


def list_comments(db: Session, entity_type: str, entity_id: str) -> list[dict[str, Any]]:
    _entity_project(db, entity_type, entity_id)
    rows = db.scalars(
        select(EntityComment)
        .where(EntityComment.entity_type == entity_type, EntityComment.entity_id == entity_id)
        .order_by(EntityComment.created_at.desc())
    ).all()
    return [serializers.comment(c) for c in rows]


def create_comment(db: Session, entity_type: str, entity_id: str, payload: dict[str, Any], *, author: str) -> dict[str, Any]:
    body = str(payload.get("body", "")).strip()
    if not body:
        raise ValidationError("comment body is required")
    project_id = _entity_project(db, entity_type, entity_id)
    comment = EntityComment(
        project_id=project_id,
        entity_type=entity_type,
        entity_id=entity_id,
        author=author or "unknown",
        body=body,
        tags=_clean_tags(payload.get("tags") or []),
    )
    db.add(comment)
    db.flush()
    return serializers.comment(comment)


def update_test_tags(db: Session, test_id: str, tags: list[Any]) -> dict[str, Any]:
    test = db.get(TestDefinition, test_id)
    if not test:
        raise NotFoundError("test not found")
    test.tags = _clean_tags(tags)
    db.flush()
    return {"id": test.id, "tags": test.tags or []}


def list_tags(db: Session, q: str = "") -> list[str]:
    needle = q.strip().lower()
    values: dict[str, str] = {}
    for tags in db.scalars(select(TestDefinition.tags)).all():
        for tag in tags or []:
            clean = str(tag).strip()
            if clean:
                values.setdefault(clean.lower(), clean)
    for tags in db.scalars(select(EntityComment.tags)).all():
        for tag in tags or []:
            clean = str(tag).strip()
            if clean:
                values.setdefault(clean.lower(), clean)
    out = sorted(values.values(), key=str.lower)
    if needle:
        out = [tag for tag in out if needle in tag.lower()]
    return out[:100]
