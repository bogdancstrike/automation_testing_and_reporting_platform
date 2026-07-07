"""Exercise the common HTTP verbs against httpbin, each as its own step."""
from src.testkit import TYPE_HTTP, HttpTest, TestMetadata

TARGET = "demo"


class HttpbinHttpMethods(HttpTest):
    """GET / POST / PUT / DELETE all behave, and POST echoes the JSON body."""

    metadata = TestMetadata(
        key="httpbin.http_methods",
        name="httpbin · HTTP methods (GET/POST/PUT/DELETE)",
        type=TYPE_HTTP,
        tags=["httpbin", "methods", "multi-step"],
        owner="admin",
        target=TARGET,
    )

    def test(self, ctx):
        with ctx.step("GET /get"):
            ctx.http.get("/get").should.have_status(200)

        with ctx.step("POST /post echoes body"):
            response = ctx.http.post("/post", json={"customer": "qtp"})
            response.should.have_status(200)
            response.json.should.have_field("json.customer").equal_to("qtp")

        with ctx.step("PUT /put"):
            ctx.http.put("/put", json={"x": 1}).should.have_status(200)

        with ctx.step("DELETE /delete"):
            ctx.http.delete("/delete").should.have_status(200)
