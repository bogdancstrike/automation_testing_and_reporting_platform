"""QTP tests itself — exercise the platform's own (unauthenticated) health API.

Target ``qtp_self`` points at QTP's own API base URL (http://api:5100/qtp in
the compose network). This is the platform validating its own liveness.
"""
from tests.automations._base import SimpleHttpTest, jpath, status, within_ms
from src.testkit.base import TYPE_HTTP, TestMetadata
from src.testkit.context import TestContext
from src.testkit.result import TestResult
from src.config import Config
import requests
import json

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
        default_config={"method": "POST", "url": "{{base_url}}/api/tests/00000000-0000-0000-0000-000000000000/run", "assertions": [status(401)]},
    )


class SelfCancelRunUnauthorized(SimpleHttpTest):
    """POST /api/runs/unknown/cancel must reject anonymous requests."""
    metadata = TestMetadata(
        key="self.cancel_run_unauthorized", name="QTP · POST /api/runs/xyz/cancel rejects anonymous (401)", type=TYPE_HTTP,
        tags=["self", "security"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/runs/00000000-0000-0000-0000-000000000000/cancel", "assertions": [status(401)]},
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

class AuthHttpTest(SimpleHttpTest):
    def setup(self, context: TestContext) -> None:
        if Config.AUTH_DISABLED:
            context.variables["auth_token"] = "auth-disabled-dummy-token"
            return
        
        token_url = f"{Config.KEYCLOAK_INTERNAL_URL.rstrip('/')}/realms/{Config.KEYCLOAK_REALM}/protocol/openid-connect/token"
        data = {
            "grant_type": "password",
            "client_id": Config.KEYCLOAK_SPA_CLIENT_ID,
            "username": Config.KEYCLOAK_ADMIN_USER,
            "password": Config.KEYCLOAK_ADMIN_PASSWORD,
        }
        try:
            # We explicitly send Host: localhost:8080 so that Keycloak mints the token
            # with `iss: http://localhost:8080/...` to match what the backend expects.
            headers = {"Host": "localhost:8080"}
            resp = requests.post(token_url, data=data, headers=headers)
            if not resp.ok:
                context.log("error", f"failed to get token: {resp.status_code} {resp.text}")
            resp.raise_for_status()
            context.variables["auth_token"] = resp.json()["access_token"]
        except Exception as e:
            context.log("error", f"exception while getting token: {e}")

    def execute(self, context: TestContext) -> TestResult:
        from src.testkit.adapters.http import execute_http
        import copy
        config = copy.deepcopy(dict(self.metadata.default_config))
        auth_dict = {"type": "bearer", "token": "{{auth_token}}"}
        if "steps" in config and isinstance(config["steps"], list):
            for step in config["steps"]:
                if "auth" not in step:
                    step["auth"] = auth_dict
        else:
            if "auth" not in config:
                config["auth"] = auth_dict
        return execute_http(config, context)

class SelfAuthenticatedTargetsCRUD(AuthHttpTest):
    """CRUD targets"""
    metadata = TestMetadata(
        key="self.auth.targets_crud", name="QTP · Targets CRUD", type=TYPE_HTTP,
        tags=["self", "api", "targets", "multi-step"], owner="admin", target=TARGET,
        default_config={
            "steps": [
                {
                    "id": "create", "name": "Create Target", "method": "POST", "url": "{{base_url}}/api/targets",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "body": {"mode": "json", "raw": json.dumps({"key": "test_tgt", "name": "Test Target", "base_url": "http://example.com"})},
                    "assertions": [status(201)], "captures": [{"name": "target_id", "source": "json_path", "path": "$.id"}]
                },
                {
                    "id": "get", "name": "Get Target", "method": "GET", "url": "{{base_url}}/api/targets/{{target_id}}",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200), jpath("$.key", "equals", "test_tgt")]
                },
                {
                    "id": "list", "name": "List Targets", "method": "GET", "url": "{{base_url}}/api/targets",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200), jpath("$.items", "exists")]
                },
                {
                    "id": "stats", "name": "Target Stats", "method": "GET", "url": "{{base_url}}/api/targets/{{target_id}}/stats",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                },
                {
                    "id": "tests", "name": "Target Tests", "method": "GET", "url": "{{base_url}}/api/targets/{{target_id}}/tests",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                },
                {
                    "id": "runs", "name": "Target Runs", "method": "GET", "url": "{{base_url}}/api/targets/{{target_id}}/runs",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                }
            ]
        }
    )

    def cleanup(self, context: TestContext) -> None:
        target_id = context.variables.get("target_id")
        if target_id:
            from src.core.db import session_scope
            from src.catalog.models import Target
            from sqlalchemy import delete
            with session_scope() as db:
                db.execute(delete(Target).where(Target.id == target_id))
            context.log("info", f"cleanup: deleted test target {target_id} from DB")

class SelfAuthenticatedTestsCRUD(AuthHttpTest):
    """CRUD Request Tests"""
    metadata = TestMetadata(
        key="self.auth.request_tests_crud", name="QTP · Request Tests CRUD", type=TYPE_HTTP,
        tags=["self", "api", "tests", "multi-step"], owner="admin", target=TARGET,
        default_config={
            "steps": [
                {
                    "id": "create", "name": "Create Test", "method": "POST", "url": "{{base_url}}/api/request-tests",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "body": {"mode": "json", "raw": json.dumps({"name": "My Auto Test", "config": {"method": "GET", "url": "http://example.com"}})},
                    "assertions": [status(201)], "captures": [{"name": "test_id", "source": "json_path", "path": "$.id"}]
                },
                {
                    "id": "get", "name": "Get Test", "method": "GET", "url": "{{base_url}}/api/tests/{{test_id}}",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                },
                {
                    "id": "list", "name": "List Tests", "method": "GET", "url": "{{base_url}}/api/tests",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                },
                {
                    "id": "update", "name": "Update Test", "method": "PATCH", "url": "{{base_url}}/api/request-tests/{{test_id}}",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "body": {"mode": "json", "raw": json.dumps({"name": "My Auto Test 2"})},
                    "assertions": [status(200)]
                },
                {
                    "id": "tags", "name": "Update Tags", "method": "PUT", "url": "{{base_url}}/api/tests/{{test_id}}/tags",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "body": {"mode": "json", "raw": json.dumps(["foo", "bar"])},
                    "assertions": [status(200)]
                },
                {
                    "id": "comment", "name": "Add Comment", "method": "POST", "url": "{{base_url}}/api/tests/{{test_id}}/comments",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "body": {"mode": "json", "raw": json.dumps({"body": "hello"})},
                    "assertions": [status(201)]
                },
                {
                    "id": "get_comments", "name": "Get Comments", "method": "GET", "url": "{{base_url}}/api/tests/{{test_id}}/comments",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                },
                {
                    "id": "run", "name": "Run Test", "method": "POST", "url": "{{base_url}}/api/tests/{{test_id}}/run",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(202)]
                },
                {
                    "id": "delete", "name": "Delete Test", "method": "DELETE", "url": "{{base_url}}/api/request-tests/{{test_id}}",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                }
            ]
        }
    )

    def cleanup(self, context: TestContext) -> None:
        test_id = context.variables.get("test_id")
        token = context.variables.get("auth_token")
        if test_id and token:
            requests.delete(f"{Config.SELF_TARGET_URL}/api/request-tests/{test_id}", headers={"Authorization": f"Bearer {token}"})
            context.log("info", "cleanup: ensured test deletion")

class SelfAuthenticatedRunsCRUD(AuthHttpTest):
    """Runs read and cancel operations"""
    metadata = TestMetadata(
        key="self.auth.runs_crud", name="QTP · Runs Read/Cancel", type=TYPE_HTTP,
        tags=["self", "api", "runs", "multi-step"], owner="admin", target=TARGET,
        default_config={
            "steps": [
                {
                    "id": "send_adhoc", "name": "Send Adhoc Request", "method": "POST", "url": "{{base_url}}/api/request-tests/send",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "body": {"mode": "json", "raw": json.dumps({"method": "GET", "url": "http://example.com"})},
                    "assertions": [status(200)]
                },
                {
                    "id": "list_runs", "name": "List Runs", "method": "GET", "url": "{{base_url}}/api/runs",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                },
                {
                    "id": "get_test", "name": "Get Test ID", "method": "GET", "url": "{{base_url}}/api/tests",
                    "assertions": [status(200)], "captures": [{"name": "test_id", "source": "json_path", "path": "$.items[0].id"}]
                },
                {
                    "id": "spawn_run", "name": "Spawn Run", "method": "POST", "url": "{{base_url}}/api/tests/{{test_id}}/run",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(202)], "captures": [{"name": "run_id", "source": "json_path", "path": "$.id"}]
                },
                {
                    "id": "get_run", "name": "Get Run", "method": "GET", "url": "{{base_url}}/api/runs/{{run_id}}",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                },
                {
                    "id": "get_logs", "name": "Get Run Logs", "method": "GET", "url": "{{base_url}}/api/runs/{{run_id}}/logs",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                },
                {
                    "id": "add_comment", "name": "Add Run Comment", "method": "POST", "url": "{{base_url}}/api/runs/{{run_id}}/comments",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "body": {"mode": "json", "raw": json.dumps({"body": "test comment"})},
                    "assertions": [status(201)]
                },
                {
                    "id": "get_comments", "name": "Get Run Comments", "method": "GET", "url": "{{base_url}}/api/runs/{{run_id}}/comments",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                },
                {
                    "id": "put_defect", "name": "Put Defect", "method": "PUT", "url": "{{base_url}}/api/runs/{{run_id}}/defect",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "body": {"mode": "json", "raw": json.dumps({"defect_id": "BUG-123"})},
                    "assertions": [status(200)]
                },
                {
                    "id": "cancel", "name": "Cancel Run", "method": "POST", "url": "{{base_url}}/api/runs/{{run_id}}/cancel",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(202)]
                }
            ]
        }
    )

    def cleanup(self, context: TestContext) -> None:
        run_id = context.variables.get("run_id")
        if run_id:
            from src.core.db import session_scope
            from src.catalog.models import Run
            from sqlalchemy import delete
            with session_scope() as db:
                db.execute(delete(Run).where(Run.id == run_id))
            context.log("info", f"cleanup: deleted test run {run_id} from DB")

class SelfAuthenticatedSchedulesCRUD(AuthHttpTest):
    """CRUD Schedules"""
    metadata = TestMetadata(
        key="self.auth.schedules_crud", name="QTP · Schedules CRUD", type=TYPE_HTTP,
        tags=["self", "api", "schedules", "multi-step"], owner="admin", target=TARGET,
        default_config={
            "steps": [
                {
                    "id": "get_test", "name": "Get Test ID", "method": "GET", "url": "{{base_url}}/api/tests",
                    "assertions": [status(200)], "captures": [{"name": "test_id", "source": "json_path", "path": "$.items[0].id"}]
                },
                {
                    "id": "create", "name": "Create Schedule", "method": "POST", "url": "{{base_url}}/api/schedules",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "body": {"mode": "json", "raw": "{\"test_definition_id\": \"{{test_id}}\", \"recurrence_type\": \"interval\", \"interval_seconds\": 3600}"},
                    "assertions": [status(201)], "captures": [{"name": "sched_id", "source": "json_path", "path": "$.id"}]
                },
                {
                    "id": "get", "name": "Get Schedule", "method": "GET", "url": "{{base_url}}/api/schedules/{{sched_id}}",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                },
                {
                    "id": "list", "name": "List Schedules", "method": "GET", "url": "{{base_url}}/api/schedules",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                },
                {
                    "id": "update", "name": "Update Schedule", "method": "PATCH", "url": "{{base_url}}/api/schedules/{{sched_id}}",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "body": {"mode": "json", "raw": json.dumps({"is_enabled": False})},
                    "assertions": [status(200)]
                },
                {
                    "id": "delete", "name": "Delete Schedule", "method": "DELETE", "url": "{{base_url}}/api/schedules/{{sched_id}}",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                }
            ]
        }
    )

    def cleanup(self, context: TestContext) -> None:
        sched_id = context.variables.get("sched_id")
        token = context.variables.get("auth_token")
        if sched_id and token:
            requests.delete(f"{Config.SELF_TARGET_URL}/api/schedules/{sched_id}", headers={"Authorization": f"Bearer {token}"})
            context.log("info", "cleanup: ensured schedule deletion")

class SelfAuthenticatedMisc(AuthHttpTest):
    """Misc GET operations"""
    metadata = TestMetadata(
        key="self.auth.misc", name="QTP · Misc Dashboards/Workers/Tags", type=TYPE_HTTP,
        tags=["self", "api", "misc", "multi-step"], owner="admin", target=TARGET,
        default_config={
            "steps": [
                {
                    "id": "workers", "name": "List Workers", "method": "GET", "url": "{{base_url}}/api/workers",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                },
                {
                    "id": "overview", "name": "Dashboards Overview", "method": "GET", "url": "{{base_url}}/api/dashboards/overview",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                },
                {
                    "id": "failures", "name": "Dashboards Failures", "method": "GET", "url": "{{base_url}}/api/dashboards/failures",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                },
                {
                    "id": "tags", "name": "List Tags", "method": "GET", "url": "{{base_url}}/api/tags",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                },
                {
                    "id": "discover", "name": "Discover Tests", "method": "POST", "url": "{{base_url}}/api/tests/discover",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)]
                },
                {
                    "id": "get_targets", "name": "List Targets", "method": "GET", "url": "{{base_url}}/api/targets",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(200)], "captures": [{"name": "demo_target_id", "source": "json_path", "path": "$.items[0].id"}]
                },
                {
                    "id": "run_all", "name": "Run All Tests", "method": "POST", "url": "{{base_url}}/api/targets/{{demo_target_id}}/run-all",
                    "auth": {"type": "bearer", "token": "{{auth_token}}"},
                    "assertions": [status(202)]
                }
            ]
        }
    )

class TargetsListPagination(AuthHttpTest):
    """QTP · Targets Pagination"""
    metadata = TestMetadata(
        key="self.auth.targets_pagination", name="QTP · Targets Pagination", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/targets?page=1&page_size=2", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(200)]}
    )

class TargetsListSorting(AuthHttpTest):
    """QTP · Targets Sorting"""
    metadata = TestMetadata(
        key="self.auth.targets_sorting", name="QTP · Targets Sorting", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/targets?sort=name&order=desc", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(200)]}
    )

class TestsListPagination(AuthHttpTest):
    """QTP · Tests Pagination"""
    metadata = TestMetadata(
        key="self.auth.tests_pagination", name="QTP · Tests Pagination", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/tests?page_size=1", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(200)]}
    )

class TestsListFilterSource(AuthHttpTest):
    """QTP · Tests Filter Source"""
    metadata = TestMetadata(
        key="self.auth.tests_filter_source", name="QTP · Tests Filter Source", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/tests?source=ui", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(200)]}
    )

class TestsListFilterTarget(AuthHttpTest):
    """QTP · Tests Filter Target"""
    metadata = TestMetadata(
        key="self.auth.tests_filter_target", name="QTP · Tests Filter Target", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/tests?target=demo", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(200)]}
    )

class RunsListPagination(AuthHttpTest):
    """QTP · Runs Pagination"""
    metadata = TestMetadata(
        key="self.auth.runs_pagination", name="QTP · Runs Pagination", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/runs?page=1&page_size=5", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(200)]}
    )

class RunsListStatusFilter(AuthHttpTest):
    """QTP · Runs Filter Status"""
    metadata = TestMetadata(
        key="self.auth.runs_filter_status", name="QTP · Runs Filter Status", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/runs?status=passed", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(200)]}
    )

class SchedulesListPagination(AuthHttpTest):
    """QTP · Schedules Pagination"""
    metadata = TestMetadata(
        key="self.auth.schedules_pagination", name="QTP · Schedules Pagination", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/schedules?page_size=5", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(200)]}
    )

class WorkersListPagination(AuthHttpTest):
    """QTP · Workers Pagination"""
    metadata = TestMetadata(
        key="self.auth.workers_pagination", name="QTP · Workers Pagination", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/workers?page_size=10", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(200)]}
    )

class TagsListPagination(AuthHttpTest):
    """QTP · Tags Pagination"""
    metadata = TestMetadata(
        key="self.auth.tags_pagination", name="QTP · Tags Pagination", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/tags?page_size=10", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(200)]}
    )

class TargetNotFound(AuthHttpTest):
    """QTP · Target 404"""
    metadata = TestMetadata(
        key="self.auth.target_404", name="QTP · Target 404", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/targets/00000000-0000-0000-0000-000000000000", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(404)]}
    )

class TargetStatsNotFound(AuthHttpTest):
    """QTP · Target Stats 404"""
    metadata = TestMetadata(
        key="self.auth.target_stats_404", name="QTP · Target Stats 404", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/targets/00000000-0000-0000-0000-000000000000/stats", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(404)]}
    )

class TargetTestsNotFound(AuthHttpTest):
    """QTP · Target Tests 404"""
    metadata = TestMetadata(
        key="self.auth.target_tests_404", name="QTP · Target Tests 404", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/targets/00000000-0000-0000-0000-000000000000/tests", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(404)]}
    )

class TargetRunsNotFound(AuthHttpTest):
    """QTP · Target Runs 404"""
    metadata = TestMetadata(
        key="self.auth.target_runs_404", name="QTP · Target Runs 404", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/targets/00000000-0000-0000-0000-000000000000/runs", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(404)]}
    )

class TestNotFound(AuthHttpTest):
    """QTP · Test 404"""
    metadata = TestMetadata(
        key="self.auth.test_404", name="QTP · Test 404", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/tests/00000000-0000-0000-0000-000000000000", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(404)]}
    )

class TestCommentsNotFound(AuthHttpTest):
    """QTP · Test Comments 404"""
    metadata = TestMetadata(
        key="self.auth.test_comments_404", name="QTP · Test Comments 404", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/tests/00000000-0000-0000-0000-000000000000/comments", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(404)]}
    )

class RunNotFound(AuthHttpTest):
    """QTP · Run 404"""
    metadata = TestMetadata(
        key="self.auth.run_404", name="QTP · Run 404", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/runs/00000000-0000-0000-0000-000000000000", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(404)]}
    )

class RunLogsNotFound(AuthHttpTest):
    """QTP · Run Logs 404"""
    metadata = TestMetadata(
        key="self.auth.run_logs_404", name="QTP · Run Logs 404", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/runs/00000000-0000-0000-0000-000000000000/logs", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(404)]}
    )

class ScheduleNotFound(AuthHttpTest):
    """QTP · Schedule 404"""
    metadata = TestMetadata(
        key="self.auth.schedule_404", name="QTP · Schedule 404", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/schedules/00000000-0000-0000-0000-000000000000", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(404)]}
    )

class RunCommentsNotFound(AuthHttpTest):
    """QTP · Run Comments 404"""
    metadata = TestMetadata(
        key="self.auth.run_comments_404", name="QTP · Run Comments 404", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/runs/00000000-0000-0000-0000-000000000000/comments", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(404)]}
    )

class CreateTargetMissingName(AuthHttpTest):
    """QTP · Create Target missing name"""
    metadata = TestMetadata(
        key="self.auth.create_target_400_name", name="QTP · Create Target missing name", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/targets", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "body": {"mode":"json","raw":"{\"key\":\"test\"}"}, "assertions": [status(400)]}
    )

class CreateTargetMissingKey(AuthHttpTest):
    """QTP · Create Target missing key"""
    metadata = TestMetadata(
        key="self.auth.create_target_400_key", name="QTP · Create Target missing key", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/targets", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "body": {"mode":"json","raw":"{\"name\":\"test\"}"}, "assertions": [status(400)]}
    )

class CreateTargetMissingBaseUrl(AuthHttpTest):
    """QTP · Create Target missing URL"""
    metadata = TestMetadata(
        key="self.auth.create_target_400_url", name="QTP · Create Target missing URL", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/targets", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "body": {"mode":"json","raw":"{\"key\":\"test\",\"name\":\"test\"}"}, "assertions": [status(400)]}
    )

class CreateTestMissingName(AuthHttpTest):
    """QTP · Create Test missing name"""
    metadata = TestMetadata(
        key="self.auth.create_test_400_name", name="QTP · Create Test missing name", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/request-tests", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "body": {"mode":"json","raw":"{\"config\":{}}"}, "assertions": [status(400)]}
    )

class CreateTestMissingConfig(AuthHttpTest):
    """QTP · Create Test missing config"""
    metadata = TestMetadata(
        key="self.auth.create_test_400_config", name="QTP · Create Test missing config", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/request-tests", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "body": {"mode":"json","raw":"{\"name\":\"test\"}"}, "assertions": [status(400)]}
    )

class AddTestCommentEmpty(AuthHttpTest):
    """QTP · Add Test Comment empty"""
    metadata = TestMetadata(
        key="self.auth.add_test_comment_400", name="QTP · Add Test Comment empty", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/tests/ui.httpbin_get/comments", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "body": {"mode":"json","raw":"{}"}, "assertions": [status(400)]}
    )

class AddRunCommentEmpty(AuthHttpTest):
    """QTP · Add Run Comment empty"""
    metadata = TestMetadata(
        key="self.auth.add_run_comment_400", name="QTP · Add Run Comment empty", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/runs/00000000-0000-0000-0000-000000000000/comments", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "body": {"mode":"json","raw":"{}"}, "assertions": [status(400)]}
    )

class PutDefectMissingId(AuthHttpTest):
    """QTP · Put Defect missing id"""
    metadata = TestMetadata(
        key="self.auth.put_defect_400", name="QTP · Put Defect missing id", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "PUT", "url": "{{base_url}}/api/runs/00000000-0000-0000-0000-000000000000/defect", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "body": {"mode":"json","raw":"{}"}, "assertions": [status(400)]}
    )

class CreateScheduleMissingTestId(AuthHttpTest):
    """QTP · Create Schedule missing test_id"""
    metadata = TestMetadata(
        key="self.auth.create_schedule_400_testid", name="QTP · Create Schedule missing test_id", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/schedules", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "body": {"mode":"json","raw":"{\"recurrence_type\":\"interval\"}"}, "assertions": [status(400)]}
    )

class CreateScheduleMissingRecurrence(AuthHttpTest):
    """QTP · Create Schedule missing recurrence"""
    metadata = TestMetadata(
        key="self.auth.create_schedule_400_recurrence", name="QTP · Create Schedule missing recurrence", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/schedules", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "body": {"mode":"json","raw":"{\"test_definition_id\":\"00000000-0000-0000-0000-000000000000\"}"}, "assertions": [status(400)]}
    )

class DashboardOverviewBadHours(AuthHttpTest):
    """QTP · Overview bad hours"""
    metadata = TestMetadata(
        key="self.auth.dashboard_overview_400", name="QTP · Overview bad hours", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/dashboards/overview?hours=abc", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(400)]}
    )

class DashboardFailuresBadHours(AuthHttpTest):
    """QTP · Failures bad hours"""
    metadata = TestMetadata(
        key="self.auth.dashboard_failures_400", name="QTP · Failures bad hours", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/dashboards/failures?hours=abc", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(400)]}
    )

class TargetStatsBadHours(AuthHttpTest):
    """QTP · Target Stats bad hours"""
    metadata = TestMetadata(
        key="self.auth.target_stats_400", name="QTP · Target Stats bad hours", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/targets/00000000-0000-0000-0000-000000000000/stats?hours=abc", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(400)]}
    )

class UpdateTestBadPayload(AuthHttpTest):
    """QTP · Update Test bad payload"""
    metadata = TestMetadata(
        key="self.auth.update_test_400", name="QTP · Update Test bad payload", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "PATCH", "url": "{{base_url}}/api/request-tests/00000000-0000-0000-0000-000000000000", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "body": {"mode":"json","raw":"[]"}, "assertions": [status(404)]}
    )

class UpdateScheduleBadPayload(AuthHttpTest):
    """QTP · Update Schedule bad payload"""
    metadata = TestMetadata(
        key="self.auth.update_schedule_400", name="QTP · Update Schedule bad payload", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "PATCH", "url": "{{base_url}}/api/schedules/00000000-0000-0000-0000-000000000000", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "body": {"mode":"json","raw":"[]"}, "assertions": [status(400)]}
    )

class TargetsMethodNotAllowed(AuthHttpTest):
    """QTP · Targets 405"""
    metadata = TestMetadata(
        key="self.auth.targets_405", name="QTP · Targets 405", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "PUT", "url": "{{base_url}}/api/targets", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(405)]}
    )

class TargetsIdMethodNotAllowed(AuthHttpTest):
    """QTP · Targets ID 405"""
    metadata = TestMetadata(
        key="self.auth.targets_id_405", name="QTP · Targets ID 405", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/targets/00000000-0000-0000-0000-000000000000", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(405)]}
    )

class TestsMethodNotAllowed(AuthHttpTest):
    """QTP · Tests 405"""
    metadata = TestMetadata(
        key="self.auth.tests_405", name="QTP · Tests 405", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "PUT", "url": "{{base_url}}/api/tests", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(405)]}
    )

class TestsIdMethodNotAllowed(AuthHttpTest):
    """QTP · Tests ID 405"""
    metadata = TestMetadata(
        key="self.auth.tests_id_405", name="QTP · Tests ID 405", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/tests/ui.httpbin_get", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(405)]}
    )

class RunsMethodNotAllowed(AuthHttpTest):
    """QTP · Runs 405"""
    metadata = TestMetadata(
        key="self.auth.runs_405", name="QTP · Runs 405", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/runs", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(405)]}
    )

class RunsIdMethodNotAllowed(AuthHttpTest):
    """QTP · Runs ID 405"""
    metadata = TestMetadata(
        key="self.auth.runs_id_405", name="QTP · Runs ID 405", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "DELETE", "url": "{{base_url}}/api/runs/00000000-0000-0000-0000-000000000000", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(405)]}
    )

class SchedulesMethodNotAllowed(AuthHttpTest):
    """QTP · Schedules 405"""
    metadata = TestMetadata(
        key="self.auth.schedules_405", name="QTP · Schedules 405", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "PUT", "url": "{{base_url}}/api/schedules", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(405)]}
    )

class WorkersMethodNotAllowed(AuthHttpTest):
    """QTP · Workers 405"""
    metadata = TestMetadata(
        key="self.auth.workers_405", name="QTP · Workers 405", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/workers", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(405)]}
    )

class DashboardsOverviewMethodNotAllowed(AuthHttpTest):
    """QTP · Dashboards Overview 405"""
    metadata = TestMetadata(
        key="self.auth.dashboards_overview_405", name="QTP · Dashboards Overview 405", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/dashboards/overview", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(405)]}
    )

class TagsMethodNotAllowed(AuthHttpTest):
    """QTP · Tags 405"""
    metadata = TestMetadata(
        key="self.auth.tags_405", name="QTP · Tags 405", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "POST", "url": "{{base_url}}/api/tags", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(405)]}
    )

class DashboardOverviewValidHours(AuthHttpTest):
    """QTP · Overview Valid Hours"""
    metadata = TestMetadata(
        key="self.auth.dashboard_overview_valid", name="QTP · Overview Valid Hours", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/dashboards/overview?hours=24", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(200)]}
    )

class DashboardFailuresValidHours(AuthHttpTest):
    """QTP · Failures Valid Hours"""
    metadata = TestMetadata(
        key="self.auth.dashboard_failures_valid", name="QTP · Failures Valid Hours", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/dashboards/failures?hours=24", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(200)]}
    )

class MeEndpointValid(AuthHttpTest):
    """QTP · Me Endpoint 200"""
    metadata = TestMetadata(
        key="self.auth.me_endpoint_valid", name="QTP · Me Endpoint 200", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/me", "auth": {"type": "bearer", "token": "{{auth_token}}"}, "assertions": [status(200)]}
    )

class AuthWithoutBearerPrefix(AuthHttpTest):
    """QTP · Auth w/o Bearer"""
    metadata = TestMetadata(
        key="self.auth.auth_no_bearer", name="QTP · Auth w/o Bearer", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/me", "auth": None, "headers": [{"name": "Authorization", "value": "Token {{auth_token}}"}], "assertions": [status(401)]}
    )

class AuthInvalidBearer(AuthHttpTest):
    """QTP · Auth Invalid Bearer"""
    metadata = TestMetadata(
        key="self.auth.auth_invalid_bearer", name="QTP · Auth Invalid Bearer", type=TYPE_HTTP,
        tags=["self", "api", "automated"], owner="admin", target=TARGET,
        default_config={"method": "GET", "url": "{{base_url}}/api/me", "auth": None, "headers": [{"name": "Authorization", "value": "Bearer invalidtoken123"}], "assertions": [status(401)]}
    )
