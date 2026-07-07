"""QTP validates its own health endpoint."""
from src.testkit import TYPE_HTTP, HttpTest, TestMetadata

TARGET = "qtp_self"


class SelfHealth(HttpTest):
    """/health is reachable, fast, and reports the service as ok."""

    metadata = TestMetadata(
        key="self.health",
        name="QTP · health returns ok",
        type=TYPE_HTTP,
        tags=["self", "health"],
        owner="admin",
        target=TARGET,
    )

    def test(self, ctx):
        response = ctx.http.get("/health")

        response.should.have_status(200)
        response.should.respond_within_ms(3000)
        response.json.should.have_field("status").equal_to("ok")
        response.json.should.have_field("service").equal_to("qtp")
