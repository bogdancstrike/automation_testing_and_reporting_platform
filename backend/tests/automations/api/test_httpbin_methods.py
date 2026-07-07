"""Example tests exercising HTTP methods against the demo target (httpbin)."""
from tests.automations._base import SimpleHttpTest, jpath, status
from src.testkit.base import TYPE_HTTP, TestMetadata

TARGET = "demo"
JSON_HEADER = [{"name": "Content-Type", "value": "application/json"}]


class HttpbinGet(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.get", name="httpbin · GET returns url", type=TYPE_HTTP,
        tags=["api", "method"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/get", "assertions": [
            status(200), jpath("$.url", "exists"),
        ]},
    )


class HttpbinGetQuery(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.get_query", name="httpbin · GET echoes query args", type=TYPE_HTTP,
        tags=["api", "query"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/get?team=qtp&n=2", "assertions": [
            status(200),
            jpath("$.args.team", "contains", "qtp"),
        ]},
    )


class HttpbinPostJson(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.post_json", name="httpbin · POST echoes JSON body", type=TYPE_HTTP,
        tags=["api", "method"], owner="admin", target=TARGET,
        default_config={
            "method": "POST", "url": "{{base_url}}/post", "headers": JSON_HEADER,
            "body": {"mode": "json", "raw": '{"item": "widget", "qty": 2}'},
            "assertions": [
                status(200),
                jpath("$.json.item", "equals", "widget"),
                jpath("$.json.qty", "equals", 2),
            ],
        },
    )


class HttpbinPut(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.put", name="httpbin · PUT accepted", type=TYPE_HTTP,
        tags=["api", "method"], owner="admin", target=TARGET,
        default_config={
            "method": "PUT", "url": "{{base_url}}/put", "headers": JSON_HEADER,
            "body": {"mode": "json", "raw": '{"updated": true}'},
            "assertions": [status(200), jpath("$.json.updated", "equals", True)],
        },
    )


class HttpbinPatch(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.patch", name="httpbin · PATCH accepted", type=TYPE_HTTP,
        tags=["api", "method"], owner="admin", target=TARGET,
        default_config={"method": "PATCH", "url": "{{base_url}}/patch", "assertions": [status(200)]},
    )


class HttpbinDelete(SimpleHttpTest):
    metadata = TestMetadata(
        key="httpbin.delete", name="httpbin · DELETE accepted", type=TYPE_HTTP,
        tags=["api", "method"], owner="admin", target=TARGET,
        default_config={"method": "DELETE", "url": "{{base_url}}/delete", "assertions": [status(200)]},
    )
