"""Shared base for the example HTTP automation tests.

`SimpleHttpTest` runs its ``metadata.default_config`` through the HTTP adapter,
so each example test only has to declare its metadata. This module is NOT in
AUTOMATION_MODULES, so discovery never treats `SimpleHttpTest` itself as a test.
"""
from src.testkit.adapters.http import execute_http
from src.testkit.base import BaseAutomationTest
from src.testkit.context import TestContext
from src.testkit.result import TestResult


class SimpleHttpTest(BaseAutomationTest):
    def execute(self, context: TestContext) -> TestResult:
        return execute_http(dict(self.metadata.default_config), context)


# Small helpers to keep assertion lists readable.
def status(code: int) -> dict:
    return {"type": "status_code", "operator": "equals", "expected": code}


def jpath(path: str, operator: str, expected=None) -> dict:
    d = {"type": "json_path", "path": path, "operator": operator}
    if expected is not None:
        d["expected"] = expected
    return d


def header(name: str, operator: str, expected=None) -> dict:
    d = {"type": "header", "path": name, "operator": operator}
    if expected is not None:
        d["expected"] = expected
    return d


def within_ms(ms: int) -> dict:
    return {"type": "response_time_ms", "operator": "lte", "expected": ms}
