"""Example code-based automation test.

Exercises the demo target's healthcheck endpoint. The URL is resolved from the
test's target (see architecture section 7) — never hard-coded — so the same
test can run against any environment by changing the target's base_url.
"""
from src.testkit.adapters.http import execute_http
from src.testkit.base import TYPE_HTTP, BaseAutomationTest, TestMetadata
from src.testkit.context import TestContext
from src.testkit.result import TestResult


class TargetHealthcheck(BaseAutomationTest):
    metadata = TestMetadata(
        key="api.target_healthcheck",
        name="Target healthcheck (200)",
        type=TYPE_HTTP,
        tags=["smoke", "api"],
        owner="admin",
        target="demo",
        default_config={
            "method": "GET",
            "url": "{{base_url}}/status/200",
            "assertions": [
                {"type": "status_code", "operator": "equals", "expected": 200},
                {"type": "response_time_ms", "operator": "lte", "expected": 5000},
            ],
        },
    )

    def execute(self, context: TestContext) -> TestResult:
        return execute_http(dict(self.metadata.default_config), context)
