"""Example tests covering status codes, headers, body, timing, redirects, auth.

Several of these assert on NON-200 responses on purpose (e.g. expect 404/500) —
demonstrating "expected response codes" as a first-class check.
"""
from tests.automations._base import (SimpleHttpTest, header, jpath, status,
                                     within_ms)
from src.testkit.base import TYPE_HTTP, TestMetadata

TARGET = "demo"


class Expect404(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.expect_404", name="httpbin · endpoint returns expected 404", type=TYPE_HTTP,
        tags=["api", "status"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/status/404", "assertions": [status(404)]},
    )


class Expect500(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.expect_500", name="httpbin · endpoint returns expected 500", type=TYPE_HTTP,
        tags=["api", "status"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/status/500", "assertions": [status(500)]},
    )


class ResponseHeaders(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.response_header", name="httpbin · custom response header echoed", type=TYPE_HTTP,
        tags=["api", "header"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/response-headers?X-Qtp=demo", "assertions": [
            status(200), header("X-Qtp", "equals", "demo"),
        ]},
    )


class ContentTypeJson(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.content_type_json", name="httpbin · Content-Type is JSON", type=TYPE_HTTP,
        tags=["api", "header"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/json", "assertions": [
            status(200), header("Content-Type", "contains", "application/json"),
            jpath("$.slideshow.title", "exists"),
        ]},
    )


class UuidFormat(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.uuid_regex", name="httpbin · uuid matches UUID regex", type=TYPE_HTTP,
        tags=["api", "regex"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/uuid", "assertions": [
            status(200),
            jpath("$.uuid", "matches", "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"),
        ]},
    )


class Headers(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.request_headers", name="httpbin · request headers reflected", type=TYPE_HTTP,
        tags=["api", "header"], owner="admin", target=TARGET,
        default_config={
            "method": "GET", "url": "{{base_url}}/headers",
            "headers": [{"name": "X-Trace", "value": "qtp-123"}],
            "assertions": [status(200), jpath("$.headers.X-Trace", "contains", "qtp-123")],
        },
    )


class RedirectFollow(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.redirect", name="httpbin · follows redirects to 200", type=TYPE_HTTP,
        tags=["api", "redirect"], owner="admin", target=TARGET,
        default_config={
            "method": "GET", "url": "{{base_url}}/redirect/2", "followRedirects": True,
            "assertions": [status(200), jpath("$.url", "exists")],
        },
    )


class ResponseTime(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.response_time", name="httpbin · responds within SLA", type=TYPE_HTTP,
        tags=["api", "perf"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/delay/0", "assertions": [
            status(200), within_ms(5000),
        ]},
    )


class BasicAuth(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.basic_auth", name="httpbin · basic auth succeeds", type=TYPE_HTTP,
        tags=["api", "auth"], owner="admin", target=TARGET,
        default_config={
            "method": "GET", "url": "{{base_url}}/basic-auth/qtp/secret",
            "auth": {"type": "basic", "username": "qtp", "password": "secret"},
            "assertions": [status(200), jpath("$.authorized", "equals", True)],
        },
    )


class BasicAuthRejected(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.basic_auth_rejected", name="httpbin · wrong basic auth rejected (401)", type=TYPE_HTTP,
        tags=["api", "auth", "security"], owner="admin", target=TARGET,
        default_config={
            "method": "GET", "url": "{{base_url}}/basic-auth/qtp/secret",
            "auth": {"type": "basic", "username": "qtp", "password": "wrong"},
            "assertions": [status(401)],
        },
    )


class BodyContains(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.body_contains", name="httpbin · raw body contains marker", type=TYPE_HTTP,
        tags=["api", "body"], owner="admin", target=TARGET,
        default_config={
            "method": "GET", "url": "{{base_url}}/anything?marker=qtp-ok",
            "assertions": [
                status(200),
                {"type": "body_text", "operator": "contains", "expected": "qtp-ok"},
                jpath("$.args.marker", "contains", "qtp-ok"),
            ],
        },
    )
