"""Catalog service: projects, targets, test definitions, discovery."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.catalog import serializers
from src.catalog.models import Project, Target, TestDefinition, TestRevision
from src.config import Config
from src.core.errors import ConflictError, NotFoundError, ValidationError
from src.testkit.base import SUPPORTED_TYPES, TYPE_HTTP
from src.testkit.registry import discover_classes


# ── Projects ───────────────────────────────────────────────────────────────
def list_projects(db: Session) -> list[dict]:
    return [serializers.project(p) for p in db.scalars(select(Project)).all()]


def default_project(db: Session) -> Project:
    p = db.scalars(select(Project).order_by(Project.created_at)).first()
    if not p:
        raise NotFoundError("no project exists; run the seed")
    return p


# ── Targets ────────────────────────────────────────────────────────────────
def list_targets(db: Session, project_id: str | None = None) -> list[dict]:
    stmt = select(Target)
    if project_id:
        stmt = stmt.where(Target.project_id == project_id)
    return [serializers.target(t) for t in db.scalars(stmt).all()]


def create_target(db: Session, payload: dict[str, Any]) -> dict:
    if not payload.get("base_url"):
        raise ValidationError("base_url is required")
    project = default_project(db)
    t = Target(
        project_id=project.id,
        key=payload.get("key") or payload["name"].lower().replace(" ", "_"),
        name=payload.get("name", payload.get("key", "target")),
        base_url=payload["base_url"].rstrip("/"),
        health_url=payload.get("health_url"),
        environment=payload.get("environment", "default"),
        default_headers=payload.get("default_headers") or {},
        tags=payload.get("tags") or [],
    )
    db.add(t)
    db.flush()
    return serializers.target(t)


def update_target(db: Session, target_id: str, payload: dict[str, Any]) -> dict:
    t = db.get(Target, target_id)
    if not t:
        raise NotFoundError("target not found")
    for field in ("name", "base_url", "health_url", "environment", "default_headers", "tags"):
        if field in payload:
            setattr(t, field, payload[field])
    db.flush()
    return serializers.target(t)


def resolve_target(db: Session, project_id: str, key: str) -> Target | None:
    return db.scalars(
        select(Target).where(Target.project_id == project_id, Target.key == key)
    ).first()


# ── Test definitions ───────────────────────────────────────────────────────
def list_tests(db: Session, filters: dict[str, Any]) -> list[dict]:
    stmt = select(TestDefinition)
    if filters.get("type"):
        stmt = stmt.where(TestDefinition.type == filters["type"])
    if filters.get("status"):
        stmt = stmt.where(TestDefinition.status == filters["status"])
    if filters.get("source"):
        stmt = stmt.where(TestDefinition.source == filters["source"])
    if filters.get("target"):
        stmt = stmt.where(TestDefinition.target_key == filters["target"])
    stmt = stmt.order_by(TestDefinition.name)
    return [serializers.test_definition(d) for d in db.scalars(stmt).all()]


def _source_code(revision) -> str | None:
    """Reflect the Python source of a code-based test's class."""
    if not revision or not revision.code_ref:
        return None
    import importlib
    import inspect
    try:
        module_name, _, class_name = revision.code_ref.partition(":")
        module = importlib.import_module(module_name)
        cls = getattr(module, class_name)
        return inspect.getsource(cls)
    except Exception:
        return None


def get_test_detail(db: Session, test_id: str) -> dict:
    d = db.get(TestDefinition, test_id)
    if not d:
        raise NotFoundError("test not found")
    detail = serializers.test_detail(d)

    latest = d.revisions[-1] if d.revisions else None
    config = (latest.config if latest else {}) or {}
    detail["config"] = config
    detail["method"] = config.get("method")
    detail["url_template"] = config.get("url")
    detail["assertions"] = config.get("assertions", [])
    detail["code_ref"] = latest.code_ref if latest else None

    # Which app does this test call?
    tgt = resolve_target(db, d.project_id, d.target_key)
    detail["target"] = (
        {"key": tgt.key, "name": tgt.name, "base_url": tgt.base_url, "health_url": tgt.health_url}
        if tgt else None
    )

    # The code snippet for the test (reflection), or the request config for UI tests.
    detail["source_code"] = _source_code(latest)
    detail["source_language"] = "python" if (latest and latest.code_ref) else "json"
    return detail


def _make_revision(db: Session, definition: TestDefinition, *, code_ref=None, config=None) -> TestRevision:
    n = (max((r.revision_number for r in definition.revisions), default=0)) + 1
    rev = TestRevision(test_definition_id=definition.id, revision_number=n,
                       code_ref=code_ref, config=config or {})
    db.add(rev)
    db.flush()
    definition.current_revision_id = rev.id
    return rev


def discover_tests(db: Session, modules: tuple[str, ...] | None = None) -> dict:
    """Import configured modules and upsert definitions/revisions idempotently."""
    modules = modules or Config.AUTOMATION_MODULES
    project = default_project(db)
    classes = discover_classes(modules)

    created, updated, unchanged = 0, 0, 0
    seen_keys = set()
    for key, cls in classes.items():
        seen_keys.add(key)
        meta = cls.metadata
        code_ref = f"{cls.__module__}:{cls.__name__}"
        d = db.scalars(select(TestDefinition).where(TestDefinition.key == key)).first()
        if d is None:
            d = TestDefinition(
                project_id=project.id, key=key, name=meta.name, type=meta.type,
                source="code", owner=meta.owner, target_key=meta.target,
                tags=list(meta.tags), status="active",
            )
            db.add(d)
            db.flush()
            _make_revision(db, d, code_ref=code_ref, config=dict(meta.default_config))
            created += 1
        else:
            latest = d.revisions[-1] if d.revisions else None
            changed = (latest is None or latest.code_ref != code_ref
                       or json.dumps(latest.config, sort_keys=True) != json.dumps(dict(meta.default_config), sort_keys=True))
            d.name, d.type, d.owner, d.target_key = meta.name, meta.type, meta.owner, meta.target
            d.tags = list(meta.tags)
            d.status = "active"
            if changed:
                _make_revision(db, d, code_ref=code_ref, config=dict(meta.default_config))
                updated += 1
            else:
                unchanged += 1

    # Code tests that vanished from source are marked, not deleted.
    missing = 0
    for d in db.scalars(select(TestDefinition).where(TestDefinition.source == "code")).all():
        if d.key not in seen_keys and d.status != "missing_from_source":
            d.status = "missing_from_source"
            missing += 1

    return {"created": created, "updated": updated, "unchanged": unchanged,
            "missing_from_source": missing, "total_found": len(classes)}


# ── UI request tests ───────────────────────────────────────────────────────
def create_request_test(db: Session, payload: dict[str, Any]) -> dict:
    name = payload.get("name")
    config = payload.get("config") or {}
    if not name:
        raise ValidationError("name is required")
    if not config.get("url"):
        raise ValidationError("config.url is required")
    project = default_project(db)
    key = payload.get("key") or f"ui.{name.lower().strip().replace(' ', '_')}"
    if db.scalars(select(TestDefinition).where(TestDefinition.key == key)).first():
        raise ConflictError(f"a test with key {key!r} already exists")
    d = TestDefinition(
        project_id=project.id, key=key, name=name, type=TYPE_HTTP, source="ui",
        owner=payload.get("owner", "admin"), target_key=config.get("target", "default"),
        tags=payload.get("tags") or [], status="active",
    )
    db.add(d)
    db.flush()
    _make_revision(db, d, config=config)
    return serializers.test_detail(d)


def update_request_test(db: Session, test_id: str, payload: dict[str, Any]) -> dict:
    d = db.get(TestDefinition, test_id)
    if not d:
        raise NotFoundError("test not found")
    if d.source != "ui":
        raise ValidationError("only UI request tests can be edited")
    if "name" in payload:
        d.name = payload["name"]
    config = payload.get("config")
    if config:
        _make_revision(db, d, config=config)
        d.target_key = config.get("target", d.target_key)
    return serializers.test_detail(d)


def delete_request_test(db: Session, test_id: str) -> dict:
    """Delete a UI request test and everything that depends on it."""
    from sqlalchemy import delete as sa_delete
    from src.execution.models import (RunLog, RunQueue, TestRun,
                                      TestRunAssertion, TestRunStep)
    from src.scheduling.models import Schedule

    d = db.get(TestDefinition, test_id)
    if not d:
        raise NotFoundError("test not found")
    if d.source != "ui":
        raise ValidationError("only UI request tests can be deleted")

    run_ids = list(db.scalars(select(TestRun.id).where(TestRun.test_definition_id == test_id)).all())
    if run_ids:
        db.execute(sa_delete(RunLog).where(RunLog.test_run_id.in_(run_ids)))
        db.execute(sa_delete(TestRunStep).where(TestRunStep.test_run_id.in_(run_ids)))
        db.execute(sa_delete(TestRunAssertion).where(TestRunAssertion.test_run_id.in_(run_ids)))
        db.execute(sa_delete(RunQueue).where(RunQueue.test_run_id.in_(run_ids)))
        db.execute(sa_delete(TestRun).where(TestRun.id.in_(run_ids)))
    db.execute(sa_delete(Schedule).where(Schedule.test_definition_id == test_id))
    db.execute(sa_delete(TestRevision).where(TestRevision.test_definition_id == test_id))
    db.execute(sa_delete(TestDefinition).where(TestDefinition.id == test_id))
    return {"deleted": test_id}
