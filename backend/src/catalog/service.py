"""Catalog service: projects, targets, test definitions, discovery."""
from __future__ import annotations

import json
import re
from datetime import timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import Float, cast, func, or_, select
from sqlalchemy.orm import Session

from src.catalog import serializers
from src.catalog.models import Project, Target, TestDefinition, TestRevision
from src.config import Config
from src.core.clock import utcnow
from src.core.errors import ConflictError, NotFoundError, ValidationError
from src.core.pagination import apply_sort, envelope, parse_page
from framework.tracing import get_tracer
from src.testkit.base import SUPPORTED_TYPES, TYPE_HTTP
from src.testkit.registry import discover_classes, discover_from_path

tracer = get_tracer()

_CAPTURE_NAME = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_.-]*$")


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
    rows = db.scalars(stmt.order_by(Target.name)).all()
    target_keys = {t.key for t in rows}
    counts = {}
    if target_keys:
        counts = dict(db.execute(select(TestDefinition.target_key, func.count()).where(TestDefinition.target_key.in_(target_keys)).group_by(TestDefinition.target_key)).all())
    out = []
    for t in rows:
        d = serializers.target(t)
        d["test_count"] = counts.get(t.key, 0)
        out.append(d)
    return out


def list_targets_page(db: Session, filters: dict[str, Any]) -> dict:
    params = parse_page(filters, default_sort="name", default_order="asc")
    stmt = select(Target)
    if params.q:
        like = f"%{params.q}%"
        stmt = stmt.where(or_(Target.name.ilike(like), Target.key.ilike(like), Target.base_url.ilike(like)))
    if filters.get("environment"):
        stmt = stmt.where(Target.environment == filters["environment"])
    stmt = apply_sort(stmt, params, {
        "name": Target.name, "key": Target.key, "base_url": Target.base_url,
        "environment": Target.environment, "created_at": Target.created_at,
    })
    total = int(db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0)
    rows = db.scalars(stmt.offset((params.page - 1) * params.page_size).limit(params.page_size)).all()
    target_keys = {t.key for t in rows}
    counts = {}
    if target_keys:
        counts = dict(db.execute(select(TestDefinition.target_key, func.count()).where(TestDefinition.target_key.in_(target_keys)).group_by(TestDefinition.target_key)).all())
    out = []
    for t in rows:
        d = serializers.target(t)
        d["test_count"] = counts.get(t.key, 0)
        out.append(d)
    return envelope(out, total, params)


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
    return db.scalars(select(Target).where(Target.project_id == project_id, Target.key == key)).first()


def _target_or_404(db: Session, target_id: str) -> Target:
    target = db.get(Target, target_id)
    if not target:
        raise NotFoundError("target not found")
    return target


# ── Request config normalization ───────────────────────────────────────────
def normalized_request_steps(config: dict[str, Any]) -> list[dict[str, Any]]:
    if isinstance(config.get("steps"), list) and config["steps"]:
        steps = [dict(s) for s in config["steps"]]
    else:
        steps = [{
            "id": "request", "name": "Request", "target": config.get("target"),
            "method": config.get("method", "GET"), "url": config.get("url", ""),
            "headers": config.get("headers") or [], "query": config.get("query") or [],
            "auth": config.get("auth"), "body": config.get("body"),
            "assertions": config.get("assertions") or [], "captures": config.get("captures") or [],
            "timeoutMs": config.get("timeoutMs"), "tlsVerify": config.get("tlsVerify"),
            "followRedirects": config.get("followRedirects"),
        }]

    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for i, raw in enumerate(steps):
        step = dict(raw)
        sid = str(step.get("id") or f"step-{i + 1}").strip()
        if not sid:
            sid = f"step-{i + 1}"
        if sid in seen:
            raise ValidationError(f"duplicate step id {sid!r}")
        seen.add(sid)
        method = str(step.get("method") or "GET").upper()
        url = str(step.get("url") or "").strip()
        if not url:
            raise ValidationError(f"step {sid!r} url is required")
        for capture in step.get("captures") or []:
            name = str(capture.get("name", "")).strip()
            if not _CAPTURE_NAME.match(name):
                raise ValidationError(f"step {sid!r} has invalid capture name {name!r}")
        step.update({"id": sid, "name": step.get("name") or f"Step {i + 1}", "method": method, "url": url})
        out.append(step)
    return out


def normalize_request_config(config: dict[str, Any]) -> dict[str, Any]:
    config = dict(config or {})
    steps = normalized_request_steps(config)
    if isinstance(config.get("steps"), list) and config["steps"]:
        top_target = config.get("target") or steps[0].get("target") or "default"
        return {**config, "target": top_target, "steps": steps}
    # Preserve legacy single-request shape for backwards compatibility.
    step = steps[0]
    legacy = {k: v for k, v in config.items() if k != "steps"}
    legacy.update({
        "target": legacy.get("target") or step.get("target") or "default",
        "method": step["method"], "url": step["url"],
        "headers": step.get("headers") or [], "assertions": step.get("assertions") or [],
    })
    for key in ("query", "auth", "body", "captures", "timeoutMs", "tlsVerify", "followRedirects"):
        if step.get(key) is not None:
            legacy[key] = step.get(key)
    return legacy


def _config_target_key(config: dict[str, Any]) -> str:
    if config.get("target"):
        return config["target"]
    steps = normalized_request_steps(config)
    return steps[0].get("target") or "default"


# ── Test definitions ───────────────────────────────────────────────────────
def list_tests(db: Session, filters: dict[str, Any]) -> dict:
    with tracer.start_as_current_span("catalog.list_tests") as span:
        span.set_attribute("query.filters", json.dumps(filters, sort_keys=True, default=str))
        return _list_tests(db, filters)


def _list_tests(db: Session, filters: dict[str, Any]) -> dict:
    params = parse_page(filters, default_sort="name", default_order="asc")
    stmt = select(TestDefinition)
    if filters.get("type"):
        stmt = stmt.where(TestDefinition.type == filters["type"])
    if filters.get("status"):
        stmt = stmt.where(TestDefinition.status == filters["status"])
    if filters.get("source"):
        stmt = stmt.where(TestDefinition.source == filters["source"])
    if filters.get("target"):
        stmt = stmt.where(TestDefinition.target_key == filters["target"])
    if filters.get("tag"):
        stmt = stmt.where(TestDefinition.tags.contains([filters["tag"]]))
    if params.q:
        like = f"%{params.q}%"
        stmt = stmt.where(or_(
            TestDefinition.name.ilike(like), TestDefinition.key.ilike(like),
            TestDefinition.owner.ilike(like), TestDefinition.target_key.ilike(like),
        ))
    stmt = apply_sort(stmt, params, {
        "name": TestDefinition.name, "key": TestDefinition.key, "type": TestDefinition.type,
        "source": TestDefinition.source, "target_key": TestDefinition.target_key,
        "last_run_at": TestDefinition.last_run_at, "last_run_status": TestDefinition.last_run_status,
        "created_at": TestDefinition.created_at, "updated_at": TestDefinition.updated_at,
    })
    total = int(db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0)
    rows = db.scalars(stmt.offset((params.page - 1) * params.page_size).limit(params.page_size)).all()
    return envelope([serializers.test_definition(d) for d in rows], total, params)


def _source_code(revision) -> str | None:
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
    steps = normalized_request_steps(config) if d.type == TYPE_HTTP and not latest.code_ref else []
    detail["config"] = config
    detail["steps"] = steps
    first = steps[0] if steps else {}
    detail["method"] = first.get("method") or config.get("method")
    detail["url_template"] = first.get("url") or config.get("url")
    detail["assertions"] = first.get("assertions") or config.get("assertions", [])
    detail["code_ref"] = latest.code_ref if latest else None

    tgt = resolve_target(db, d.project_id, d.target_key)
    detail["target"] = (
        {"id": tgt.id, "key": tgt.key, "name": tgt.name, "base_url": tgt.base_url, "health_url": tgt.health_url}
        if tgt else None
    )
    detail["source_code"] = _source_code(latest)
    detail["source_language"] = "python" if (latest and latest.code_ref) else "json"
    return detail


def _make_revision(db: Session, definition: TestDefinition, *, code_ref=None, config=None) -> TestRevision:
    n = (max((r.revision_number for r in definition.revisions), default=0)) + 1
    rev = TestRevision(test_definition_id=definition.id, revision_number=n, code_ref=code_ref, config=config or {})
    db.add(rev)
    db.flush()
    definition.current_revision_id = rev.id
    return rev


def discover_tests(db: Session, modules: tuple[str, ...] | None = None) -> dict:
    with tracer.start_as_current_span("catalog.discover_tests") as span:
        result = _discover_tests(db, modules)
        span.set_attribute("discovery.total_found", result.get("total_found", 0))
        span.set_attribute("discovery.created", result.get("created", 0))
        span.set_attribute("discovery.updated", result.get("updated", 0))
        return result


def _discover_tests(db: Session, modules: tuple[str, ...] | None = None) -> dict:
    project = default_project(db)
    if modules:
        classes = discover_classes(modules)
    else:
        root = Path(__file__).resolve().parents[2] / "tests" / "automations"
        classes = discover_from_path(root)
        # Explicit module list remains a fallback for older deployments.
        if not classes and Config.AUTOMATION_MODULES:
            classes = discover_classes(Config.AUTOMATION_MODULES)

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
            d.tags = list(dict.fromkeys([*(d.tags or []), *list(meta.tags)]))
            d.status = "active"
            if changed:
                _make_revision(db, d, code_ref=code_ref, config=dict(meta.default_config))
                updated += 1
            else:
                unchanged += 1

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
    config = normalize_request_config(payload.get("config") or {})
    if not name:
        raise ValidationError("name is required")
    project = default_project(db)
    key = payload.get("key") or f"ui.{name.lower().strip().replace(' ', '_')}"
    if db.scalars(select(TestDefinition).where(TestDefinition.key == key)).first():
        raise ConflictError(f"a test with key {key!r} already exists")
    d = TestDefinition(
        project_id=project.id, key=key, name=name, type=TYPE_HTTP, source="ui",
        owner=payload.get("owner", "admin"), target_key=_config_target_key(config),
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
        normalized = normalize_request_config(config)
        _make_revision(db, d, config=normalized)
        d.target_key = _config_target_key(normalized)
    return serializers.test_detail(d)


def delete_request_test(db: Session, test_id: str) -> dict:
    from sqlalchemy import delete as sa_delete
    from src.execution.models import RunLog, RunQueue, TestRun, TestRunAssertion, TestRunStep
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


# ── Target detail / stats ──────────────────────────────────────────────────
def get_target_detail(db: Session, target_id: str) -> dict:
    with tracer.start_as_current_span("target.detail") as span:
        span.set_attribute("target.id", target_id)
        return _get_target_detail(db, target_id)


def _get_target_detail(db: Session, target_id: str) -> dict:
    from src.execution.models import TestRun
    from src.scheduling.models import Schedule

    target = _target_or_404(db, target_id)
    tests_stmt = select(TestDefinition.id).where(
        TestDefinition.project_id == target.project_id,
        TestDefinition.target_key == target.key,
    )
    test_ids = list(db.scalars(tests_stmt).all())
    status_counts = dict(db.execute(
        select(TestRun.status, func.count()).where(TestRun.target_id == target.id).group_by(TestRun.status)
    ).all())
    finished = sum(status_counts.get(s, 0) for s in ("passed", "failed", "error", "timeout"))
    passed = status_counts.get("passed", 0)
    durations = db.execute(select(
        func.percentile_cont(0.5).within_group(cast(TestRun.duration_ms, Float)),
        func.percentile_cont(0.95).within_group(cast(TestRun.duration_ms, Float)),
        func.avg(cast(TestRun.duration_ms, Float)),
    ).where(TestRun.target_id == target.id, TestRun.duration_ms.isnot(None))).first()
    p50, p95, avg = (durations or (None, None, None))
    scheduled = 0
    if test_ids:
        scheduled = int(db.scalar(select(func.count()).select_from(Schedule).where(Schedule.test_definition_id.in_(test_ids))) or 0)
    return {
        "target": serializers.target(target),
        "test_count": len(test_ids),
        "scheduled_test_count": scheduled,
        "totals": {**status_counts, "total_runs": sum(status_counts.values())},
        "pass_rate": round(passed / finished, 4) if finished else None,
        "duration_ms": {"p50": p50, "p95": p95, "avg": round(avg, 1) if avg else None},
        "status_distribution": status_counts,
    }


def target_tests(db: Session, target_id: str, filters: dict[str, Any]) -> dict:
    target = _target_or_404(db, target_id)
    return list_tests(db, {**filters, "target": target.key})


def target_runs(db: Session, target_id: str, filters: dict[str, Any]) -> dict:
    from src.execution import service as execution
    _target_or_404(db, target_id)
    return execution.list_runs(db, {**filters, "target_id": target_id})


def target_stats(db: Session, target_id: str, *, hours: int = 168) -> dict:
    with tracer.start_as_current_span("target.stats") as span:
        span.set_attribute("target.id", target_id)
        span.set_attribute("window.hours", hours)
        result = _target_stats(db, target_id, hours=hours)
        span.set_attribute("stats.trend_points", len(result.get("trend", [])))
        span.set_attribute("stats.recent_failed", len(result.get("recent_failed", [])))
        return result


def _target_stats(db: Session, target_id: str, *, hours: int = 168) -> dict:
    from src.execution.models import TestRun

    target = _target_or_404(db, target_id)
    since = utcnow() - timedelta(hours=hours)
    bucket = func.date_trunc("hour", TestRun.queued_at)
    trend_rows = db.execute(
        select(bucket.label("bucket"), TestRun.status, func.count())
        .where(TestRun.target_id == target.id, TestRun.queued_at >= since)
        .group_by("bucket", TestRun.status).order_by("bucket")
    ).all()
    trend: dict[str, dict] = {}
    for b, status, count in trend_rows:
        key = b.isoformat()
        trend.setdefault(key, {"bucket": key})
        trend[key][status] = count

    duration_rows = db.execute(
        select(bucket.label("bucket"), func.avg(cast(TestRun.duration_ms, Float)))
        .where(TestRun.target_id == target.id, TestRun.queued_at >= since, TestRun.duration_ms.isnot(None))
        .group_by("bucket").order_by("bucket")
    ).all()
    durations = [{"bucket": b.isoformat(), "avg_ms": round(avg, 1) if avg else None} for b, avg in duration_rows]

    defect_distribution = dict(db.execute(
        select(TestRun.defect_type, func.count())
        .where(TestRun.target_id == target.id, TestRun.queued_at >= since, TestRun.status.in_(["failed", "error", "timeout"]))
        .group_by(TestRun.defect_type)
    ).all())
    defect_distribution = {(k or "untriaged"): v for k, v in defect_distribution.items()}

    recent = db.scalars(
        select(TestRun).where(TestRun.target_id == target.id, TestRun.status.in_(["failed", "error", "timeout"]))
        .order_by(TestRun.queued_at.desc()).limit(10)
    ).all()
    def_ids = {r.test_definition_id for r in recent}
    defs = {d.id: d for d in db.scalars(select(TestDefinition).where(TestDefinition.id.in_(def_ids))).all()} if def_ids else {}
    recent_failed = [{
        "id": r.id, "test_definition_id": r.test_definition_id,
        "test_name": defs[r.test_definition_id].name if r.test_definition_id in defs else None,
        "status": r.status, "error_category": r.error_category,
        "defect_type": r.defect_type, "finished_at": r.finished_at.isoformat() if r.finished_at else None,
    } for r in recent]

    tests = db.scalars(select(TestDefinition).where(TestDefinition.project_id == target.project_id, TestDefinition.target_key == target.key).order_by(TestDefinition.name)).all()
    latest_per_test = [{
        "id": d.id, "key": d.key, "name": d.name,
        "last_run_status": d.last_run_status, "last_run_at": d.last_run_at.isoformat() if d.last_run_at else None,
    } for d in tests]

    return {
        "target_id": target.id, "window_hours": hours,
        "trend": sorted(trend.values(), key=lambda x: x["bucket"]),
        "duration_trend": durations,
        "defect_distribution": defect_distribution,
        "recent_failed": recent_failed,
        "latest_per_test": latest_per_test,
    }
