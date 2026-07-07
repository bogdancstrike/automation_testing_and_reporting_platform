"""Additional httpbin scenarios covering echo, redirects, auth, cookies, and payloads."""
from src.testkit import TYPE_HTTP, HttpTest, TestMetadata

TARGET = "demo"


def _meta(key: str, name: str, tags: list[str]) -> TestMetadata:
    return TestMetadata(
        key=key,
        name=name,
        type=TYPE_HTTP,
        tags=["httpbin", *tags],
        owner="admin",
        target=TARGET,
    )


class HttpbinUuidShape(HttpTest):
    metadata = _meta("httpbin.uuid_shape", "httpbin · UUID shape", ["uuid"])

    def test(self, ctx):
        response = ctx.http.get("/uuid")
        response.should.have_status(200)
        response.json.should.have_field("uuid").matching(r"^[0-9a-f-]{36}$")


class HttpbinJsonSlideshow(HttpTest):
    metadata = _meta("httpbin.json_slideshow", "httpbin · sample JSON slideshow", ["json"])

    def test(self, ctx):
        response = ctx.http.get("/json")
        response.should.have_status(200)
        response.json.should.have_field("slideshow.title").exists()
        response.json.should.have_field("slideshow.slides").with_length_at_least(1)


class HttpbinUserAgentEcho(HttpTest):
    metadata = _meta("httpbin.user_agent_echo", "httpbin · user agent echo", ["headers"])

    def test(self, ctx):
        response = ctx.http.get("/user-agent", headers={"User-Agent": "qtp-scenario"})
        response.should.have_status(200)
        response.json.should.have_field("user-agent").containing("qtp-scenario")


class HttpbinHeaderRoundTrip(HttpTest):
    metadata = _meta("httpbin.header_round_trip", "httpbin · custom header round trip", ["headers"])

    def test(self, ctx):
        response = ctx.http.get("/headers", headers={"X-QTP-Trace": "trace-123"})
        response.should.have_status(200)
        response.json.should.have_field("headers.X-Qtp-Trace[0]").equal_to("trace-123")


class HttpbinResponseHeaders(HttpTest):
    metadata = _meta("httpbin.response_headers", "httpbin · response headers endpoint", ["headers"])

    def test(self, ctx):
        response = ctx.http.get("/response-headers", params={"X-QTP-Mode": "probe"})
        response.should.have_status(200)
        response.should.have_header("X-QTP-Mode").containing("probe")


class HttpbinRedirectToGet(HttpTest):
    metadata = _meta("httpbin.redirect_to_get", "httpbin · redirect-to lands on GET", ["redirect"])

    def test(self, ctx):
        response = ctx.http.get("/redirect-to", params={"url": "/get", "status_code": 302})
        response.should.have_status(200)
        response.json.should.have_field("url").containing("/get")


class HttpbinRelativeRedirect(HttpTest):
    metadata = _meta("httpbin.relative_redirect", "httpbin · relative redirect", ["redirect"])

    def test(self, ctx):
        response = ctx.http.get("/relative-redirect/1")
        response.should.have_status(200)
        response.json.should.have_field("url").exists()


class HttpbinAbsoluteRedirect(HttpTest):
    metadata = _meta("httpbin.absolute_redirect", "httpbin · absolute redirect", ["redirect"])

    def test(self, ctx):
        response = ctx.http.get("/absolute-redirect/1")
        response.should.have_status(200)
        response.json.should.have_field("url").exists()


class HttpbinCookiesSetAndRead(HttpTest):
    metadata = _meta("httpbin.cookies_set_and_read", "httpbin · cookies set and read", ["cookies", "multi-step"])

    def test(self, ctx):
        with ctx.step("Set cookie"):
            response = ctx.http.get("/cookies/set", params={"session": "qtp-cookie"})
            response.should.have_status(200)

        with ctx.step("Read cookie through same session"):
            response = ctx.http.get("/cookies")
            response.should.have_status(200)
            response.json.should.have_field("session").equal_to("qtp-cookie")


class HttpbinDeleteEchoes(HttpTest):
    metadata = _meta("httpbin.delete_echoes", "httpbin · DELETE echoes request", ["methods"])

    def test(self, ctx):
        response = ctx.http.delete("/delete", params={"delete_id": "42"})
        response.should.have_status(200)
        response.json.should.have_field("args.delete_id[0]").equal_to("42")


class HttpbinPatchEchoesJson(HttpTest):
    metadata = _meta("httpbin.patch_echoes_json", "httpbin · PATCH echoes JSON", ["methods", "json"])

    def test(self, ctx):
        response = ctx.http.patch("/patch", json={"operation": "replace", "id": 7})
        response.should.have_status(200)
        response.json.should.have_field("json.operation").equal_to("replace")
        response.json.should.have_field("json.id").equal_to(7)


class HttpbinPutEchoesForm(HttpTest):
    metadata = _meta("httpbin.put_echoes_form", "httpbin · PUT echoes form data", ["methods", "form"])

    def test(self, ctx):
        response = ctx.http.put("/put", data={"name": "qtp", "kind": "form"})
        response.should.have_status(200)
        response.json.should.have_field("form.name[0]").equal_to("qtp")
        response.json.should.have_field("form.kind[0]").equal_to("form")


class HttpbinPostTextEcho(HttpTest):
    metadata = _meta("httpbin.post_text_echo", "httpbin · POST echoes text body", ["methods", "body"])

    def test(self, ctx):
        response = ctx.http.post("/post", text="plain body from qtp")
        response.should.have_status(200)
        response.should.contain_text("plain body from qtp")


class HttpbinAnythingCapturesQuery(HttpTest):
    metadata = _meta("httpbin.anything_captures_query", "httpbin · anything captures query", ["anything", "multi-step"])

    def test(self, ctx):
        with ctx.step("Call anything with a trace id"):
            response = ctx.http.get("/anything/alpha", params={"trace": "qtp-flow"})
            response.should.have_status(200)
            trace = response.json.get("args.trace[0]")
            ctx.set_var("trace", trace)

        with ctx.step("Reuse captured trace id"):
            response = ctx.http.get("/get", params={"trace": "{{trace}}"})
            response.should.have_status(200)
            response.json.should.have_field("args.trace[0]").equal_to("qtp-flow")


class HttpbinStatus204(HttpTest):
    metadata = _meta("httpbin.status_204", "httpbin · status 204", ["status"])

    def test(self, ctx):
        response = ctx.http.get("/status/204")
        response.should.have_status(204)


class HttpbinStatus429(HttpTest):
    metadata = _meta("httpbin.status_429", "httpbin · status 429", ["status"])

    def test(self, ctx):
        response = ctx.http.get("/status/429")
        response.should.have_status(429)


class HttpbinDelayCompletes(HttpTest):
    metadata = _meta("httpbin.delay_completes", "httpbin · delay completes within budget", ["delay"])

    def test(self, ctx):
        response = ctx.http.get("/delay/1", timeout_ms=5000)
        response.should.have_status(200)
        response.should.respond_within_ms(5000)


class HttpbinGzipPayload(HttpTest):
    metadata = _meta("httpbin.gzip_payload", "httpbin · gzip payload", ["compression"])

    def test(self, ctx):
        response = ctx.http.get("/gzip")
        response.should.have_status(200)
        response.json.should.have_field("gzipped").equal_to(True)


class HttpbinBearerAuth(HttpTest):
    metadata = _meta("httpbin.bearer_auth", "httpbin · bearer auth", ["auth"])

    def test(self, ctx):
        response = ctx.http.get("/bearer", auth={"type": "bearer", "token": "qtp-token"})
        response.should.have_status(200)
        response.json.should.have_field("authenticated").equal_to(True)
        response.json.should.have_field("token").equal_to("qtp-token")


class HttpbinStreamReturnsLines(HttpTest):
    metadata = _meta("httpbin.stream_lines", "httpbin · stream returns JSON lines", ["stream"])

    def test(self, ctx):
        response = ctx.http.get("/stream/2")
        response.should.have_status(200)
        response.should.contain_text('"id":0')
        response.should.contain_text('"id":1')
