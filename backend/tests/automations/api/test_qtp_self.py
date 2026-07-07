"""QTP tests itself — exercise the platform's own (unauthenticated) health API.

Target ``qtp_self`` points at QTP's own API base URL (http://api:5100/qtp in
the compose network). This is the platform validating its own liveness.
"""
from tests.automations._base import SimpleHttpTest, jpath, status, within_ms
from src.testkit.base import TYPE_HTTP, TestMetadata

TARGET = "qtp_self"


class SelfHealth(SimpleHttpTest):
    metadata = TestMetadata(
        key="self.health", name="QTP · health returns ok", type=TYPE_HTTP,
        tags=["self", "health"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/health", "assertions": [
            status(200),
            jpath("$.status", "equals", "ok"),
            jpath("$.service", "equals", "qtp"),
            within_ms(3000),
        ]},
    )


class SelfLiveness(SimpleHttpTest):
    metadata = TestMetadata(
        key="self.liveness", name="QTP · liveness is alive", type=TYPE_HTTP,
        tags=["self", "health"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/liveness", "assertions": [
            status(200), jpath("$.status", "equals", "alive"),
        ]},
    )


class SelfReadiness(SimpleHttpTest):
    metadata = TestMetadata(
        key="self.readiness", name="QTP · readiness (db reachable)", type=TYPE_HTTP,
        tags=["self", "health"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/readiness", "assertions": [
            status(200), jpath("$.status", "equals", "ready"),
        ]},
    )


class SelfMeRequiresAuth(SimpleHttpTest):
    """/api/me must reject an unauthenticated request — asserts the 401."""
    metadata = TestMetadata(
        key="self.me_requires_auth", name="QTP · /api/me rejects anonymous (401)", type=TYPE_HTTP,
        tags=["self", "security"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/me", "assertions": [
            status(401),
        ]},
    )
