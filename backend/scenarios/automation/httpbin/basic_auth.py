"""httpbin's /basic-auth guards a route — right creds pass, wrong creds get 401."""
from src.testkit import TYPE_HTTP, HttpTest, TestMetadata

TARGET = "demo"


class HttpbinBasicAuth(HttpTest):
    """Basic auth succeeds with matching credentials and is rejected otherwise."""

    metadata = TestMetadata(
        key="httpbin.basic_auth",
        name="httpbin · basic auth accepts/rejects",
        type=TYPE_HTTP,
        tags=["httpbin", "auth", "multi-step"],
        owner="admin",
        target=TARGET,
    )

    def test(self, ctx):
        with ctx.step("correct credentials pass"):
            response = ctx.http.get(
                "/basic-auth/qtp/secret",
                auth={"type": "basic", "username": "qtp", "password": "secret"},
            )
            response.should.have_status(200)
            response.json.should.have_field("authorized").equal_to(True)
            response.json.should.have_field("user").equal_to("qtp")

        with ctx.step("wrong credentials are rejected"):
            response = ctx.http.get(
                "/basic-auth/qtp/secret",
                auth={"type": "basic", "username": "qtp", "password": "WRONG"},
            )
            response.should.have_status(401)
