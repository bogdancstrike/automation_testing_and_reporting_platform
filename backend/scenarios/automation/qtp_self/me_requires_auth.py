"""/api/me must reject anonymous callers and accept a valid bearer token."""
from src.testkit import TYPE_HTTP, HttpTest, TestMetadata

TARGET = "qtp_self"
SYSTEM_TOKEN = {"type": "bearer", "token": "system-bearer-token"}


class SelfMeRequiresAuth(HttpTest):
    """Anonymous → 401; system bearer token → 200 with a principal."""

    metadata = TestMetadata(
        key="self.me_requires_auth",
        name="QTP · /api/me rejects anonymous, accepts token",
        type=TYPE_HTTP,
        tags=["self", "security"],
        owner="admin",
        target=TARGET,
    )

    def test(self, ctx):
        with ctx.step("anonymous is rejected"):
            ctx.http.get("/api/me").should.have_status(401)

        with ctx.step("authenticated is accepted"):
            response = ctx.http.get("/api/me", auth=SYSTEM_TOKEN)
            response.should.have_status(200)
            response.json.should.have_field("username").exists()
