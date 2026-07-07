"""A workflow scenario that sequentially checks health, liveness and readiness."""
from src.testkit import TYPE_HTTP, HttpTest, TestMetadata

TARGET = "qtp_self"


class SelfMultiStepHealthLivenessReadiness(HttpTest):
    """Walk the three probes in order, each as its own step in run detail."""

    metadata = TestMetadata(
        key="self.multi_health",
        name="QTP · Multi-step Health/Liveness/Readiness",
        type=TYPE_HTTP,
        tags=["self", "health", "multi-step"],
        owner="admin",
        target=TARGET,
    )

    def test(self, ctx):
        with ctx.step("Check Health"):
            response = ctx.http.get("/health")
            response.should.have_status(200)
            response.json.should.have_field("status").equal_to("ok")

        with ctx.step("Check Liveness"):
            response = ctx.http.get("/liveness")
            response.should.have_status(200)
            response.json.should.have_field("status").equal_to("alive")

        with ctx.step("Check Readiness"):
            response = ctx.http.get("/readiness")
            response.should.have_status(200)
            response.json.should.have_field("status").equal_to("ready")
