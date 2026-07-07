"""httpbin lets us force a status code and echo a custom header back."""
from src.testkit import TYPE_HTTP, HttpTest, TestMetadata

TARGET = "demo"


class HttpbinStatusAndHeaders(HttpTest):
    """Force a 418, then confirm a request header is reflected in the response."""

    metadata = TestMetadata(
        key="httpbin.status_and_headers",
        name="httpbin · forced status + reflected header",
        type=TYPE_HTTP,
        tags=["httpbin", "status", "headers", "multi-step"],
        owner="admin",
        target=TARGET,
    )

    def test(self, ctx):
        with ctx.step("GET /status/418 returns 418"):
            ctx.http.get("/status/418").should.have_status(418)

        with ctx.step("request headers are reflected"):
            response = ctx.http.get("/headers", headers={"X-QTP-Probe": "scenario-42"})
            response.should.have_status(200)
            response.json.should.have_field("headers.X-Qtp-Probe").equal_to("scenario-42")

        with ctx.step("response content-type is JSON"):
            response = ctx.http.get("/json")
            response.should.have_status(200)
            response.should.have_header("Content-Type").containing("application/json")
