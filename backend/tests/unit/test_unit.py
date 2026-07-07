import pytest
from datetime import datetime, timezone, timedelta
from src.testkit.assertions import json_path_get, evaluate_all, _MISSING
from src.scheduling.recurrence import compute_next
from src.core.errors import ValidationError

# Mock class for schedule
class MockSchedule:
    def __init__(self, recurrence_type, interval_seconds=None, cron_expression=None, start_at=None, last_enqueued_at=None):
        self.recurrence_type = recurrence_type
        self.interval_seconds = interval_seconds
        self.cron_expression = cron_expression
        self.start_at = start_at
        self.last_enqueued_at = last_enqueued_at


# --- Recurrence tests ---
def test_compute_next_once():
    # Never enqueued
    start = datetime(2026, 7, 7, 12, 0, tzinfo=timezone.utc)
    s = MockSchedule("once", start_at=start)
    assert compute_next(s) == start

    # Already enqueued
    s.last_enqueued_at = start
    assert compute_next(s) is None


def test_compute_next_interval():
    start = datetime(2026, 7, 7, 12, 0, tzinfo=timezone.utc)
    s = MockSchedule("interval", interval_seconds=60, start_at=start)
    # If now is before start, next is start + interval
    now = datetime(2026, 7, 7, 11, 59, tzinfo=timezone.utc)
    assert compute_next(s, after=now) == start + timedelta(seconds=60)

    # Next run calculation moving forward in intervals
    s.last_enqueued_at = start
    now = datetime(2026, 7, 7, 12, 0, 30, tzinfo=timezone.utc)
    assert compute_next(s, after=now) == start + timedelta(seconds=60)

    # Error case: non-positive interval
    s_err = MockSchedule("interval", interval_seconds=0)
    with pytest.raises(ValidationError, match="interval_seconds must be positive"):
        compute_next(s_err)


def test_compute_next_cron():
    s = MockSchedule("cron", cron_expression="*/5 * * * *")
    now = datetime(2026, 7, 7, 12, 0, tzinfo=timezone.utc)
    # next should be 12:05
    assert compute_next(s, after=now) == datetime(2026, 7, 7, 12, 5, tzinfo=timezone.utc)

    s_err = MockSchedule("cron", cron_expression="invalid cron")
    with pytest.raises(ValidationError, match="invalid cron expression"):
        compute_next(s_err)


# --- Assertions tests ---
def test_json_path_get():
    data = {
        "user": {
            "name": "Alice",
            "roles": ["admin", "user"]
        },
        "meta": {"x-trace-id": "123"}
    }
    assert json_path_get(data, "$.user.name") == "Alice"
    assert json_path_get(data, "$.user.roles[0]") == "admin"
    assert json_path_get(data, "$.meta.x-trace-id") == "123"
    assert json_path_get(data, "$.absent") is _MISSING


def test_evaluate_all():
    resp = {
        "status_code": 200,
        "elapsed_ms": 150,
        "headers": {"Content-Type": "application/json", "X-Trace": "abc"},
        "body_text": '{"status": "ok", "items": [1, 2, 3]}'
    }

    specs = [
        {"type": "status_code", "operator": "equals", "expected": 200},
        {"type": "status_code", "operator": "not_equals", "expected": 400},
        {"type": "response_time_ms", "operator": "lte", "expected": 300},
        {"type": "header", "name": "Content-Type", "operator": "contains", "expected": "json"},
        {"type": "header", "name": "X-Trace", "operator": "equals", "expected": "abc"},
        {"type": "json_path", "path": "$.status", "operator": "equals", "expected": "ok"},
        {"type": "json_path", "path": "$.items", "operator": "length_gte", "expected": 2},
    ]

    results = evaluate_all(specs, resp)
    assert len(results) == len(specs)
    for r in results:
        assert r.passed, f"Failed: {r.source} {r.operator} {r.expected}"
