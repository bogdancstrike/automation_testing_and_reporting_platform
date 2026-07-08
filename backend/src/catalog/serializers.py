"""Serializers — explicit dict shapes so the API never leaks ORM internals."""
from __future__ import annotations

from typing import Any

from src.catalog.models import Project, Target, TestDefinition, TestRevision


def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


def project(p: Project) -> dict[str, Any]:
    return {"id": p.id, "key": p.key, "name": p.name, "created_at": _iso(p.created_at)}


def target(t: Target) -> dict[str, Any]:
    return {
        "id": t.id, "project_id": t.project_id, "key": t.key, "name": t.name,
        "base_url": t.base_url, "health_url": t.health_url, "environment": t.environment,
        "default_headers": t.default_headers or {}, "tags": t.tags or [],
        "created_at": _iso(t.created_at),
    }


def revision(r: TestRevision) -> dict[str, Any]:
    from src.catalog.service import _source_code
    return {
        "id": r.id, "revision_number": r.revision_number, "code_ref": r.code_ref,
        "config": r.config or {}, "created_at": _iso(r.created_at),
        "source_code": _source_code(r) or (r.config or {}).get("source_code"),
    }


def test_definition(d: TestDefinition) -> dict[str, Any]:
    return {
        "id": d.id, "project_id": d.project_id, "key": d.key, "name": d.name,
        "type": d.type, "source": d.source, "owner": d.owner, "target_key": d.target_key,
        "tags": d.tags or [], "status": d.status,
        "current_revision_id": d.current_revision_id,
        "last_run_status": d.last_run_status, "last_run_at": _iso(d.last_run_at),
        "created_at": _iso(d.created_at), "updated_at": _iso(d.updated_at),
    }


def test_detail(d: TestDefinition) -> dict[str, Any]:
    out = test_definition(d)
    out["revisions"] = [revision(r) for r in d.revisions]
    return out
