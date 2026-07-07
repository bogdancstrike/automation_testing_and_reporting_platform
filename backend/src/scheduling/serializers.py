"""Schedule serializer."""
from __future__ import annotations

from src.scheduling.models import Schedule


def _iso(dt):
    return dt.isoformat() if dt else None


def schedule(s: Schedule, *, test_name: str | None = None, tests: list[dict] | None = None) -> dict:
    tests = tests or []
    test_ids = [t["id"] for t in tests] or ([s.test_definition_id] if s.test_definition_id else [])
    return {
        "id": s.id, "project_id": s.project_id, "test_definition_id": s.test_definition_id,
        "test_definition_ids": test_ids, "tests": tests, "scenario_count": len(test_ids),
        "test_name": test_name, "name": s.name,
        "recurrence_type": s.recurrence_type, "interval_seconds": s.interval_seconds,
        "cron_expression": s.cron_expression, "timezone": s.timezone,
        "environment": s.environment, "is_enabled": s.is_enabled,
        "start_at": _iso(s.start_at), "end_at": _iso(s.end_at),
        "next_run_at": _iso(s.next_run_at), "last_enqueued_at": _iso(s.last_enqueued_at),
        "created_at": _iso(s.created_at),
    }
