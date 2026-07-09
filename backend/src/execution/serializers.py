"""Run serializers."""
from __future__ import annotations

from typing import Any

from src.execution.models import TestRun, TestRunAssertion, TestRunStep


def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


def run_summary(r: TestRun, *, test_name: str | None = None, target_key: str | None = None, tags: list[str] | None = None) -> dict[str, Any]:
    return {
        "id": r.id, "project_id": r.project_id, "scenario_id": r.scenario_id,
        "revision_id": r.revision_id,
        "test_name": test_name, "target_id": r.target_id, "target_key": target_key,
        "tags": tags or [],
        "status": r.status, "trigger": r.trigger, "environment": r.environment,
        "worker_name": r.worker_name, "triggered_by": r.triggered_by,
        "schedule_id": r.schedule_id,
        "error_category": r.error_category, "error_message": r.error_message,
        "cleanup_failed": r.cleanup_failed, "cleanup_error": r.cleanup_error,
        "defect_type": r.defect_type, "failure_signature": r.failure_signature,
        "trace_id": r.trace_id,
        "duration_ms": r.duration_ms,
        "queued_at": _iso(r.queued_at), "started_at": _iso(r.started_at),
        "finished_at": _iso(r.finished_at),
        "stats_reset_at": _iso(r.stats_reset_at), "stats_reset_by": r.stats_reset_by,
        "metrics": r.metrics or {},
    }


def _step(s: TestRunStep) -> dict[str, Any]:
    return {"id": s.id, "ord": s.ord, "name": s.name, "status": s.status,
            "duration_ms": s.duration_ms, "error": s.error, "timings": s.timings}


def _assertion(a: TestRunAssertion) -> dict[str, Any]:
    return {"source": a.source, "operator": a.operator, "target": a.target,
            "expected": a.expected, "actual": a.actual, "passed": a.passed, "message": a.message}


def run_detail(r: TestRun, **extra) -> dict[str, Any]:
    out = run_summary(r, **extra)
    out["steps"] = [_step(s) for s in r.steps]
    out["assertions"] = [_assertion(a) for a in r.assertions]
    out["response"] = r.response or {}
    return out
