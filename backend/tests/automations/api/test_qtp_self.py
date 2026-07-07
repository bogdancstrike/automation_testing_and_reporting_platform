"""QTP tests itself — exercise the platform's own (unauthenticated) health API.

Target ``qtp_self`` points at QTP's own API base URL (http://api:5100/qtp in
the compose network). This is the platform validating its own liveness.
"""
from tests.automations._base import SimpleHttpTest, jpath, status, within_ms
from src.testkit.base import TYPE_HTTP, TestMetadata

TARGET = "qtp_self"


class SelfHealth(SimpleHttpTest):
    """Basic health check ensuring the API is reachable and returns an ok status."""
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
    """Liveness probe ensuring the service is up."""
    metadata = TestMetadata(
        key="self.liveness", name="QTP · liveness is alive", type=TYPE_HTTP,
        tags=["self", "health"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/liveness", "assertions": [
            status(200), jpath("$.status", "equals", "alive"),
        ]},
    )


class SelfReadiness(SimpleHttpTest):
    """Readiness probe ensuring database connections and other critical paths are active."""
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


class SelfTargetsUnauthorized(SimpleHttpTest):
    """GET /api/targets must reject anonymous requests."""
    metadata = TestMetadata(
        key="self.targets_unauthorized", name="QTP · /api/targets rejects anonymous (401)", type=TYPE_HTTP,
        tags=["self", "security"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/targets", "assertions": [status(401)]},
    )


class SelfTestsUnauthorized(SimpleHttpTest):
    """GET /api/tests must reject anonymous requests."""
    metadata = TestMetadata(
        key="self.tests_unauthorized", name="QTP · /api/tests rejects anonymous (401)", type=TYPE_HTTP,
        tags=["self", "security"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/tests", "assertions": [status(401)]},
    )


class SelfRunsUnauthorized(SimpleHttpTest):
    """GET /api/runs must reject anonymous requests."""
    metadata = TestMetadata(
        key="self.runs_unauthorized", name="QTP · /api/runs rejects anonymous (401)", type=TYPE_HTTP,
        tags=["self", "security"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/runs", "assertions": [status(401)]},
    )


class SelfSchedulesUnauthorized(SimpleHttpTest):
    """GET /api/schedules must reject anonymous requests."""
    metadata = TestMetadata(
        key="self.schedules_unauthorized", name="QTP · /api/schedules rejects anonymous (401)", type=TYPE_HTTP,
        tags=["self", "security"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/schedules", "assertions": [status(401)]},
    )


class SelfWorkersUnauthorized(SimpleHttpTest):
    """GET /api/workers must reject anonymous requests."""
    metadata = TestMetadata(
        key="self.workers_unauthorized", name="QTP · /api/workers rejects anonymous (401)", type=TYPE_HTTP,
        tags=["self", "security"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/workers", "assertions": [status(401)]},
    )


class SelfOverviewUnauthorized(SimpleHttpTest):
    """GET /api/dashboards/overview must reject anonymous requests."""
    metadata = TestMetadata(
        key="self.overview_unauthorized", name="QTP · /api/dashboards/overview rejects anonymous (401)", type=TYPE_HTTP,
        tags=["self", "security"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/dashboards/overview", "assertions": [status(401)]},
    )


class SelfFailuresUnauthorized(SimpleHttpTest):
    """GET /api/dashboards/failures must reject anonymous requests."""
    metadata = TestMetadata(
        key="self.failures_unauthorized", name="QTP · /api/dashboards/failures rejects anonymous (401)", type=TYPE_HTTP,
        tags=["self", "security"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/dashboards/failures", "assertions": [status(401)]},
    )


class SelfTagsUnauthorized(SimpleHttpTest):
    """GET /api/tags must reject anonymous requests."""
    metadata = TestMetadata(
        key="self.tags_unauthorized", name="QTP · /api/tags rejects anonymous (401)", type=TYPE_HTTP,
        tags=["self", "security"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/tags", "assertions": [status(401)]},
    )


class SelfCreateTargetUnauthorized(SimpleHttpTest):
    """POST /api/targets must reject anonymous requests."""
    metadata = TestMetadata(
        key="self.create_target_unauthorized", name="QTP · POST /api/targets rejects anonymous (401)", type=TYPE_HTTP,
        tags=["self", "security"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/targets", "body": {"mode": "json", "raw": "{}"}, "assertions": [status(401)]},
    )


class SelfDiscoverUnauthorized(SimpleHttpTest):
    """POST /api/tests/discover must reject anonymous requests."""
    metadata = TestMetadata(
        key="self.discover_unauthorized", name="QTP · POST /api/tests/discover rejects anonymous (401)", type=TYPE_HTTP,
        tags=["self", "security"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/tests/discover", "assertions": [status(401)]},
    )


class SelfRunTestUnauthorized(SimpleHttpTest):
    """POST /api/tests/unknown/run must reject anonymous requests."""
    metadata = TestMetadata(
        key="self.run_test_unauthorized", name="QTP · POST /api/tests/xyz/run rejects anonymous (401)", type=TYPE_HTTP,
        tags=["self", "security"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/tests/xyz/run", "assertions": [status(401)]},
    )


class SelfCancelRunUnauthorized(SimpleHttpTest):
    """POST /api/runs/unknown/cancel must reject anonymous requests."""
    metadata = TestMetadata(
        key="self.cancel_run_unauthorized", name="QTP · POST /api/runs/xyz/cancel rejects anonymous (401)", type=TYPE_HTTP,
        tags=["self", "security"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/runs/xyz/cancel", "assertions": [status(401)]},
    )


class SelfMissingEndpoint(SimpleHttpTest):
    """GET /api/this-does-not-exist must return 404."""
    metadata = TestMetadata(
        key="self.missing_endpoint", name="QTP · missing endpoint returns 404", type=TYPE_HTTP,
        tags=["self", "routing"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/this-does-not-exist", "assertions": [status(404)]},
    )


class SelfMethodNotAllowed(SimpleHttpTest):
    """POST /health must return 405 Method Not Allowed."""
    metadata = TestMetadata(
        key="self.method_not_allowed", name="QTP · POST /health returns 405", type=TYPE_HTTP,
        tags=["self", "routing"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/health", "assertions": [status(405)]},
    )


class SelfMultiStepHealthLivenessReadiness(SimpleHttpTest):
    """A multi-step test that sequentially hits /health, /liveness, and /readiness."""
    metadata = TestMetadata(
        key="self.multi_health", name="QTP · Multi-step Health/Liveness/Readiness", type=TYPE_HTTP,
        tags=["self", "health", "multi-step"], owner="admin", target=TARGET,
        default_config={
            "steps": [
                {
                    "id": "step-1", "name": "Check Health",
                    "method": "GET", "url": "{{base_url}}/health",
                    "assertions": [status(200), jpath("$.status", "equals", "ok")]
                },
                {
                    "id": "step-2", "name": "Check Liveness",
                    "method": "GET", "url": "{{base_url}}/liveness",
                    "assertions": [status(200), jpath("$.status", "equals", "alive")]
                },
                {
                    "id": "step-3", "name": "Check Readiness",
                    "method": "GET", "url": "{{base_url}}/readiness",
                    "assertions": [status(200), jpath("$.status", "equals", "ready")]
                }
            ]
        },
    )


class SelfMultiStepSecurityScan(SimpleHttpTest):
    """A multi-step test that sequentially hits multiple protected endpoints to ensure all return 401."""
    metadata = TestMetadata(
        key="self.multi_security", name="QTP · Multi-step Security Scan (401s)", type=TYPE_HTTP,
        tags=["self", "security", "multi-step"], owner="admin", target=TARGET,
        default_config={
            "steps": [
                {
                    "id": "s1", "name": "Get Targets",
                    "method": "GET", "url": "{{base_url}}/api/targets",
                    "assertions": [status(401)]
                },
                {
                    "id": "s2", "name": "Get Tests",
                    "method": "GET", "url": "{{base_url}}/api/tests",
                    "assertions": [status(401)]
                },
                {
                    "id": "s3", "name": "Get Runs",
                    "method": "GET", "url": "{{base_url}}/api/runs",
                    "assertions": [status(401)]
                },
                {
                    "id": "s4", "name": "Post Request Test",
                    "method": "POST", "url": "{{base_url}}/api/request-tests",
                    "body": {"mode": "json", "raw": "{}"},
                    "assertions": [status(401)]
                }
            ]
        },
    )
