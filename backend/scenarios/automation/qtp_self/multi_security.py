"""A workflow scenario asserting protected endpoints reject anonymous access."""
from src.testkit import TYPE_HTTP, HttpTest, TestMetadata

TARGET = "qtp_self"


class SelfMultiStepSecurityScan(HttpTest):
    """Every protected endpoint must answer 401 without a bearer token."""

    metadata = TestMetadata(
        key="self.multi_security",
        name="QTP · Multi-step Security Scan (401s)",
        type=TYPE_HTTP,
        tags=["self", "security", "multi-step"],
        owner="admin",
        target=TARGET,
    )

    def test(self, ctx):
        self.assert_rejects_anonymous(ctx, "GET", "/api/targets")
        self.assert_rejects_anonymous(ctx, "GET", "/api/scenarios")
        self.assert_rejects_anonymous(ctx, "GET", "/api/runs")
        self.assert_rejects_anonymous(ctx, "POST", "/api/request-tests", json_body={})

    def assert_rejects_anonymous(self, ctx, method, path, json_body=None):
        with ctx.step(f"{method} {path} rejects anonymous"):
            response = ctx.http.request(method, path, json=json_body)
            response.should.have_status(401)
