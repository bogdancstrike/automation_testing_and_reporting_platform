"""Scenario base classes — the way to author automation tests.

A scenario is one Python file with one class. You override ``test(self, ctx)``
and drive the target imperatively; the framework assembles the run result from
the steps and assertions you record:

    from src.testkit import HttpTest, TestMetadata, TYPE_HTTP, TARGET_from  # (see __init__)

    class SelfHealth(HttpTest):
        metadata = TestMetadata(
            key="self.health", name="QTP · health returns ok", type=TYPE_HTTP,
            tags=["self", "health"], owner="admin", target="qtp_self",
        )

        def test(self, ctx):
            response = ctx.http.get("/health")
            response.should.have_status(200)
            response.should.respond_within_ms(3000)
            response.json.should.have_field("status").equal_to("ok")

Pick the base for the target's technology: ``HttpTest`` (ctx.http), ``CliTest``
(ctx.cli), ``PlaywrightTest`` (ctx.browser), or ``PythonTest`` (anything). They
share the same lifecycle (``setup → test → cleanup → teardown``) and the same
fluent assertions.
"""
from __future__ import annotations

from src.testkit.base import (TYPE_CLI, TYPE_HTTP, TYPE_PLAYWRIGHT, TYPE_PYTHON,
                              TYPE_SELENIUM, BaseAutomationTest)
from src.testkit.context import TestContext
from src.testkit.fluent import AssertionFailure
from src.testkit.result import (ERROR, FAILED, PASSED, StepResult, TestResult)


class Scenario(BaseAutomationTest):
    """Imperative base. Subclasses implement ``test(ctx)`` instead of ``execute``.

    The default ``execute`` runs ``test``, catches assertion failures (→ failed)
    and unexpected exceptions (→ error), and builds a ``TestResult`` from the
    steps/assertions the scenario recorded on the context. Fail-fast: the first
    failed assertion stops the scenario.
    """

    # Marker for the default capability/type if a subclass forgets to set one.
    default_type: str = TYPE_PYTHON

    def test(self, ctx: TestContext) -> None:
        raise NotImplementedError("a scenario must implement test(self, ctx)")

    def execute(self, ctx: TestContext) -> TestResult:
        ctx._begin_scenario()
        status, err_cat, err_msg = PASSED, None, None
        try:
            self.test(ctx)
        except AssertionFailure as e:
            status, err_cat, err_msg = FAILED, "assertion_failed", str(e)
            ctx.log("warning", f"assertion failed: {e}")
        except Exception as e:  # noqa: BLE001
            status, err_cat, err_msg = ERROR, "script_error", str(e)
            ctx.log("error", f"scenario error: {e}")
        finally:
            if ctx._browser is not None:  # release the browser if one was opened
                try:
                    ctx._browser.close()
                except Exception:  # pragma: no cover
                    pass

        # Safety net if a soft assertion recorded a failure without raising.
        if status == PASSED and any(not a.passed for a in ctx._assertions):
            status, err_cat, err_msg = FAILED, "assertion_failed", "one or more assertions failed"

        steps = list(ctx._steps) or [StepResult(name=self.metadata.name, status=status, step_id="step-1")]
        metrics: dict = {}
        if ctx._last_response:
            metrics = {"elapsed_ms": ctx._last_response.get("elapsed_ms"),
                       "status_code": ctx._last_response.get("status_code")}
        return TestResult(
            status=status, steps=steps, assertions=list(ctx._assertions),
            error_category=err_cat, error_message=err_msg,
            response=ctx._last_response or {}, metrics=metrics,
        )


class HttpTest(Scenario):
    """HTTP scenario. Use ``ctx.http.get/post/...`` and ``response.should``."""
    default_type = TYPE_HTTP


class CliTest(Scenario):
    """CLI / container scenario (Testkube-style). Use ``ctx.cli.run(...)``."""
    default_type = TYPE_CLI


class PlaywrightTest(Scenario):
    """Browser scenario. Use ``ctx.browser.visit(...)`` (needs a Playwright image)."""
    default_type = TYPE_PLAYWRIGHT


class SeleniumTest(Scenario):
    """Selenium scenario placeholder (shares the imperative lifecycle)."""
    default_type = TYPE_SELENIUM


class PythonTest(Scenario):
    """Free-form scenario — any Python, plus ctx.http/cli/browser if useful."""
    default_type = TYPE_PYTHON
