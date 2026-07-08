"""The runner: load a claimed run, execute its adapter, persist everything."""
from __future__ import annotations

import importlib
import time

from sqlalchemy.orm import Session

from src.catalog.models import Target, TestDefinition, TestRevision
from src.config import Config
from src.core.clock import utcnow
from framework.tracing import get_tracer
from src.execution.failure_classifier import record_failure
from src.execution.models import (RunLog, TestRun, TestRunAssertion,
                                  TestRunStep)
from src.testkit.adapters.http import execute_http
from src.testkit.adapters.stubs import unsupported
from src.testkit.base import TYPE_HTTP
from src.testkit.subprocess_exec import BROWSER_TYPES, run_scenario_in_subprocess
from src.testkit.context import ResolvedTarget, TestContext
from src.testkit.result import (CANCELED, ERROR, FAILED, RUNNING, TERMINAL_STATUSES,
                                TIMEOUT, TestResult)
from src.core.secrets import get_secrets_for_project

tracer = get_tracer()


def mark_run_running(db: Session, run: TestRun, worker_name: str) -> None:
    """Mark a run as visibly in progress within the caller's transaction."""
    run.status = RUNNING
    run.worker_name = worker_name
    if run.started_at is None:
        run.started_at = utcnow()
    db.flush()


def _build_context(db: Session, run: TestRun, definition: TestDefinition,
                   target: Target | None) -> TestContext:
    ctx = TestContext(correlation_id=run.correlation_id)
    ctx.secrets = get_secrets_for_project(db, run.project_id)
    if target:
        ctx.targets[target.key] = ResolvedTarget(
            key=target.key, base_url=target.base_url,
            default_headers=dict(target.default_headers or {}),
        )
        ctx.variables["base_url"] = target.base_url

    def _cancelled() -> bool:
        db.refresh(run, ["cancel_requested"])
        return bool(run.cancel_requested)

    ctx.cancel_check = _cancelled
    return ctx


def _run_code_test(code_ref: str, ctx: TestContext) -> TestResult:
    module_name, _, class_name = code_ref.partition(":")
    module = importlib.import_module(module_name)
    cls = getattr(module, class_name)
    instance = cls()
    result: TestResult
    try:
        instance.validate_config(dict(getattr(cls.metadata, "default_config", {})))
        instance.setup(ctx)
        result = instance.execute(ctx)
    except Exception as e:  # pragma: no cover - defensive
        result = TestResult(status=ERROR, error_category="script_error", error_message=str(e))
    finally:
        # cleanup() runs on success AND failure (undo test-created data); a
        # cleanup failure is logged but never changes the test's status.
        try:
            instance.cleanup(ctx)
        except Exception as e:
            result.cleanup_failed = True
            result.cleanup_error = str(e)
            ctx.log("warning", f"cleanup() failed: {e}")
        try:
            instance.teardown(ctx)
        except Exception as e:
            ctx.log("warning", f"teardown() failed: {e}")
    return result


def execute_run(db: Session, run: TestRun, worker_name: str) -> None:
    """Execute a claimed run and persist its outcome. Commits are the caller's."""
    with tracer.start_as_current_span("execution.run") as span:
        span.set_attribute("run.id", run.id)
        span.set_attribute("run.test_definition_id", run.test_definition_id)
        span.set_attribute("worker.name", worker_name)
        definition = db.get(TestDefinition, run.test_definition_id)
        revision = db.get(TestRevision, run.revision_id) if run.revision_id else None
        target = db.get(Target, run.target_id) if run.target_id else None
        if definition:
            span.set_attribute("test.key", definition.key)
            span.set_attribute("test.type", definition.type)
        if target:
            span.set_attribute("target.key", target.key)

        mark_run_running(db, run, worker_name)

        ctx = _build_context(db, run, definition, target)

        if ctx.should_cancel():
            result = TestResult(status=CANCELED, error_category="canceled", error_message="canceled before execution")
        else:
            started = time.monotonic()
            try:
                if revision and revision.code_ref:
                    # Browser scenarios run out-of-process: sync Playwright/Selenium
                    # cannot share the worker's gevent hub (see subprocess_exec).
                    if definition and definition.type in BROWSER_TYPES:
                        result = run_scenario_in_subprocess(
                            revision.code_ref, ctx, timeout_s=Config.BROWSER_RUN_TIMEOUT_S)
                    else:
                        result = _run_code_test(revision.code_ref, ctx)
                elif definition.type == TYPE_HTTP:
                    result = execute_http(dict(revision.config if revision else {}), ctx)
                else:
                    result = unsupported(definition.type)(dict(revision.config if revision else {}), ctx)
            except Exception as e:  # pragma: no cover
                span.record_exception(e)
                result = TestResult(status=ERROR, error_category="script_error", error_message=str(e))
            result.metrics.setdefault("elapsed_ms", int((time.monotonic() - started) * 1000))

        span.set_attribute("run.status", result.status)
        span.set_attribute("run.elapsed_ms", result.metrics.get("elapsed_ms", 0))
        if result.error_message:
            span.set_attribute("run.error", result.error_message)
        _persist(db, run, definition, ctx, result)

def _persist(db: Session, run: TestRun, definition: TestDefinition,
             ctx: TestContext, result: TestResult) -> None:
    status = result.status if result.status in TERMINAL_STATUSES else ERROR
    run.status = status
    run.finished_at = utcnow()
    run.duration_ms = result.metrics.get("elapsed_ms")
    run.error_category = result.error_category
    run.error_message = result.error_message
    run.cleanup_failed = result.cleanup_failed
    run.cleanup_error = result.cleanup_error
    run.response = result.response or {}
    run.metrics = result.metrics or {}

    for i, step in enumerate(result.steps):
        db.add(TestRunStep(test_run_id=run.id, ord=i, name=step.name, status=step.status,
                           duration_ms=step.duration_ms, error=step.error, timings=step.timings))
    for i, a in enumerate(result.assertions):
        db.add(TestRunAssertion(
            test_run_id=run.id, ord=i, source=a.source, operator=a.operator,
            target=str(a.target) if a.target is not None else None,
            expected=a.expected, actual=a.actual, passed=a.passed, message=a.message,
        ))
    for entry in ctx.logs():
        db.add(RunLog(test_run_id=run.id, level=entry["level"],
                      message=entry["message"], context=entry.get("context", {})))

    if status in (FAILED, ERROR, TIMEOUT):
        sig, suggested = record_failure(db, run)
        run.failure_signature = sig
        if not run.defect_type:
            run.defect_type = suggested

    if definition:
        definition.last_run_status = status
        definition.last_run_at = run.finished_at
    db.flush()
