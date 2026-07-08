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


# --- Browser subprocess isolation ---
# Browser scenarios (playwright/selenium) run in a fresh child interpreter so the
# sync browser APIs don't collide with the worker's gevent hub. These drive the
# real spawn path against pure PythonTest scenarios (type-agnostic plumbing).
from src.testkit.context import ResolvedTarget
from src.testkit.context import TestContext as _TestContext  # aliased: pytest would try to collect a `Test*` class
from src.testkit.subprocess_exec import run_scenario_in_subprocess


def _browser_ctx():
    ctx = _TestContext(correlation_id="test-corr")
    ctx.secrets = {"tok": "SECRET"}
    ctx.targets["qtp_self"] = ResolvedTarget(key="qtp_self", base_url="https://example.com")
    return ctx


def test_subprocess_folds_result_and_logs_back():
    ctx = _browser_ctx()
    res = run_scenario_in_subprocess(
        "scenarios.automation.qtp_self.test_python:QtpSelfPythonTest1", ctx, timeout_s=30)
    assert res.status == "passed"
    assert any(a.source == "json_roundtrip" and a.passed for a in res.assertions)
    # child logs are spliced into the parent context for persistence
    assert any("roundtrip" in e["message"].lower() for e in ctx.logs())


def test_subprocess_bad_code_ref_is_script_error():
    ctx = _browser_ctx()
    res = run_scenario_in_subprocess(
        "scenarios.automation.qtp_self.test_python:NoSuchClass", ctx, timeout_s=30)
    assert res.status == "error"
    assert res.error_category == "script_error"


def test_subprocess_timeout_kills_and_reports(tmp_path):
    # A throwaway sleeper scenario written where discovery can import it.
    import pathlib
    root = pathlib.Path(__file__).resolve().parents[2]  # backend/
    sleeper = root / "scenarios" / "automation" / "qtp_self" / "_tmp_test_sleeper.py"
    sleeper.write_text(
        "import time\n"
        "from src.testkit import PythonTest, TYPE_PYTHON, TestMetadata\n"
        "class Sleeper(PythonTest):\n"
        "    metadata = TestMetadata(key='qtp_self._sleeper', name='s', type=TYPE_PYTHON, target='qtp_self')\n"
        "    def test(self, ctx):\n"
        "        time.sleep(30)\n"
    )
    try:
        ctx = _browser_ctx()
        res = run_scenario_in_subprocess(
            "scenarios.automation.qtp_self._tmp_test_sleeper:Sleeper", ctx, timeout_s=2)
        assert res.status == "timeout"
        assert res.error_category == "timeout"
    finally:
        sleeper.unlink(missing_ok=True)
