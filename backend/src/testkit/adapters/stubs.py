"""Placeholder adapters for test types not runnable in this deployment.

Playwright/Selenium/CLI executors require browser binaries or container runtimes
that the demo image does not ship. They return a clear ERROR result instead of
crashing the worker, so the lifecycle and reporting paths still exercise them.
"""
from __future__ import annotations

from typing import Any

from src.testkit.context import TestContext
from src.testkit.result import ERROR, TestResult


def unsupported(test_type: str) -> "callable":
    def _run(config: dict[str, Any], ctx: TestContext) -> TestResult:
        ctx.log("error", f"adapter {test_type!r} is not enabled in this deployment")
        return TestResult(
            status=ERROR,
            error_category="setup_error",
            error_message=f"adapter {test_type!r} not available in this deployment image",
        )
    return _run
