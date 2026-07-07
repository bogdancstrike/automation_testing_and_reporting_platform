"""QTP testkit — the authoring surface for code-based automation scenarios.

Author a scenario by importing from this package:

    from src.testkit import HttpTest, TestMetadata, TYPE_HTTP

    class SelfHealth(HttpTest):
        metadata = TestMetadata(key="self.health", name="...", type=TYPE_HTTP,
                                tags=["self"], owner="admin", target="qtp_self")

        def test(self, ctx):
            ctx.http.get("/health").should.have_status(200)
"""
from src.testkit.base import (SUPPORTED_TYPES, TYPE_CLI, TYPE_HTTP,
                              TYPE_PLAYWRIGHT, TYPE_PYTHON, TYPE_SELENIUM,
                              BaseAutomationTest, TestMetadata)
from src.testkit.context import TestContext
from src.testkit.fluent import AssertionFailure, Response
from src.testkit.result import (AssertionResult, StepResult, TestResult)
from src.testkit.scenario import (CliTest, HttpTest, PlaywrightTest, PythonTest,
                                  Scenario, SeleniumTest)

__all__ = [
    # base
    "BaseAutomationTest", "TestMetadata", "TestContext",
    "TYPE_HTTP", "TYPE_CLI", "TYPE_PLAYWRIGHT", "TYPE_PYTHON", "TYPE_SELENIUM",
    "SUPPORTED_TYPES",
    # scenario bases
    "Scenario", "HttpTest", "CliTest", "PlaywrightTest", "PythonTest", "SeleniumTest",
    # results / assertions
    "TestResult", "StepResult", "AssertionResult", "Response", "AssertionFailure",
]
