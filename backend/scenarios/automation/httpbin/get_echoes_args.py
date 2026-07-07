"""httpbin echoes query args back in the JSON body — assert on the body, not just 200."""
from src.testkit import TYPE_HTTP, HttpTest, TestMetadata

# The httpbin demo app-under-test is registered under target key "demo".
TARGET = "demo"


class HttpbinGetEchoesArgs(HttpTest):
    """GET /get?team=qtp returns the args in $.args, quickly."""

    metadata = TestMetadata(
        key="httpbin.get_echoes_args",
        name="httpbin · GET echoes query args",
        type=TYPE_HTTP,
        tags=["httpbin", "query"],
        owner="admin",
        target=TARGET,
    )

    def test(self, ctx):
        response = ctx.http.get("/get", params={"team": "qtp", "n": 2})

        response.should.have_status(200)
        response.should.respond_within_ms(5000)
        # go-httpbin returns each query arg as an array of values.
        response.json.should.have_field("args.team[0]").equal_to("qtp")
        response.json.should.have_field("args.n[0]").equal_to("2")
