"""A free-form Python scenario: loop with real control flow, still using ctx.http.

PythonTest is the escape hatch for logic that doesn't fit a single request —
here we sweep a list of status codes and assert httpbin returns each one.
"""
from src.testkit import TYPE_PYTHON, PythonTest, TestMetadata

TARGET = "demo"


class HttpbinPythonStatusSweep(PythonTest):
    """Drive httpbin for several status codes in a Python loop."""

    metadata = TestMetadata(
        key="httpbin.python_status_sweep",
        name="httpbin · Python sweep over status codes",
        type=TYPE_PYTHON,
        tags=["httpbin", "python", "multi-step"],
        owner="admin",
        target=TARGET,
    )

    def test(self, ctx):
        for code in (200, 201, 202, 400, 404, 500):
            with ctx.step(f"GET /status/{code}"):
                ctx.http.get(f"/status/{code}").should.have_status(code)
