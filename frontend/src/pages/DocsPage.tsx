import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Anchor, Card, Col, Row, Typography, Table, Tag, Alert, Divider, Collapse, Tabs } from "antd";
import {
  RocketOutlined, ApiOutlined, ExperimentOutlined, ClusterOutlined,
  SafetyOutlined, SettingOutlined, BugOutlined, ThunderboltOutlined,
  CloudServerOutlined, CodeOutlined, ToolOutlined, QuestionCircleOutlined,
  ScheduleOutlined, AimOutlined, LockOutlined,
} from "@ant-design/icons";

const { Title, Paragraph, Text } = Typography;

function Code({ children }: { children: string }) {
  return <pre className="qtp-code">{children}</pre>;
}

function SectionHeader({ id, icon, title }: { id: string; icon: React.ReactNode; title: string }) {
  return (
    <Title level={3} id={id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 32 }}>
      {icon} {title}
    </Title>
  );
}

/* ─────────────── Code Snippets ─────────────── */

const PY_TEST = `# tests/automations/api/test_create_order.py
from src.testkit.adapters.http import execute_http
from src.testkit.base import TYPE_HTTP, BaseAutomationTest, TestMetadata
from src.testkit.context import TestContext
from src.testkit.result import TestResult


class CreateOrderTest(BaseAutomationTest):
    """Verifies the Orders API can create a new order.

    Targets the 'orders_api' application — its base_url is resolved
    at run time so this exact test runs against dev/staging/prod.
    """

    metadata = TestMetadata(
        key="api.create_order",
        name="Orders API creates an order",
        type=TYPE_HTTP,
        tags=["api", "orders", "smoke"],
        owner="admin",
        target="orders_api",
        default_config={
            "method": "POST",
            "url": "{{base_url}}/api/orders",
            "headers": [{"name": "Content-Type", "value": "application/json"}],
            "body": {"mode": "json", "raw": '{"item": "widget", "qty": 2}'},
            "assertions": [
                {"type": "status_code", "operator": "equals", "expected": 201},
                {"type": "json_path", "path": "$.id", "operator": "exists"},
                {"type": "json_path", "path": "$.status", "operator": "equals", "expected": "created"},
            ],
        },
    )

    def setup(self, ctx: TestContext) -> None:
        # Optional: seed prerequisites, resolve secrets, etc.
        self._created_id = None

    def execute(self, ctx: TestContext) -> TestResult:
        result = execute_http(dict(self.metadata.default_config), ctx)
        # Capture the created id so cleanup can remove it
        body = result.response.get("body_text", "")
        self._created_id = ctx  # ... parse id from body as needed
        return result

    def cleanup(self, ctx: TestContext) -> None:
        # Runs on success AND failure, before teardown. Undo what execute
        # created so runs don't leak state. GET-only tests skip this.
        if getattr(self, "_created_id", None):
            execute_http({
                "method": "DELETE",
                "url": "{{base_url}}/api/orders/" + str(self._created_id),
                "assertions": [{"type": "status_code", "operator": "in", "expected": [200, 204]}],
            }, ctx)`;

const PY_SIMPLE = `# tests/automations/api/test_health.py
from src.testkit.adapters.http import execute_http
from src.testkit.base import TYPE_HTTP, BaseAutomationTest, TestMetadata
from src.testkit.context import TestContext
from src.testkit.result import TestResult


class HealthcheckTest(BaseAutomationTest):
    """Simplest possible test — just a GET with one assertion."""

    metadata = TestMetadata(
        key="api.healthcheck",
        name="API Healthcheck",
        type=TYPE_HTTP,
        tags=["health", "smoke"],
        target="my_api",
        default_config={
            "method": "GET",
            "url": "{{base_url}}/health",
            "assertions": [
                {"type": "status_code", "operator": "equals", "expected": 200},
            ],
        },
    )

    def execute(self, ctx: TestContext) -> TestResult:
        return execute_http(dict(self.metadata.default_config), ctx)`;

const DISCOVER = `# Tests are auto-discovered by scanning backend/tests/automations/ recursively.
# No manual module registration is required.

# Trigger discovery from the UI:  Test Catalog -> "Discover code tests"
# Or via the API:
curl -X POST http://localhost:5100/qtp/api/tests/discover \\
     -H "Authorization: Bearer $TOKEN"

# Response includes counts:
# {"discovered": 22, "created": 5, "updated": 2, "missing": 0}`;

const RUN_NOW = `# On demand (also the "Run now" button in the catalog / test detail):
curl -X POST http://localhost:5100/qtp/api/tests/<test_id>/run \\
     -H "Authorization: Bearer $TOKEN" \\
     -H "Content-Type: application/json" \\
     -d '{"environment": "default"}'

# Response — the enqueued run:
# {"id": "run-uuid", "status": "queued", "trigger": "manual", ...}`;

const RUN_ALL = `# Run ALL tests for a specific target at once:
curl -X POST http://localhost:5100/qtp/api/targets/<target_id>/run-all \\
     -H "Authorization: Bearer $TOKEN" \\
     -H "Content-Type: application/json" \\
     -d '{"environment": "default"}'

# For CI pipelines — use sync mode to block until all complete:
curl -X POST "http://localhost:5100/qtp/api/targets/<target_id>/run-all?sync=true" \\
     -H "Authorization: Bearer system-bearer-token" \\
     -H "Content-Type: application/json" \\
     -d '{"environment": "default"}'`;

const SCHED = `# Every 5 minutes:
curl -X POST http://localhost:5100/qtp/api/schedules \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"test_definition_id":"<id>","recurrence_type":"interval","interval_seconds":300}'

# Cron (weekdays 09:00 UTC):
curl -X POST http://localhost:5100/qtp/api/schedules \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"test_definition_id":"<id>","recurrence_type":"cron","cron_expression":"0 9 * * 1-5","timezone":"UTC"}'

# One-shot (run once at a specific time):
  -d '{"test_definition_id":"<id>","recurrence_type":"once","run_at":"2025-03-01T09:00:00Z"}'`;

const SAVE_UI = `POST /qtp/api/request-tests
{
  "name": "Orders API creates order",
  "config": {
    "target": "orders_api",
    "method": "POST",
    "url": "{{base_url}}/api/orders",
    "headers": [{"name": "Content-Type", "value": "application/json"}],
    "body": {"mode": "json", "raw": "{\\"item\\":\\"widget\\"}"},
    "assertions": [
      {"type": "status_code", "operator": "equals", "expected": 201},
      {"type": "json_path", "path": "$.id", "operator": "exists"}
    ]
  }
}`;

const SAVE_UI_FLOW = `POST /qtp/api/request-tests
{
  "name": "Multi-step Login + Create Flow",
  "config": {
    "steps": [
      {
        "id": "get_token",
        "name": "Authenticate",
        "method": "POST",
        "url": "{{base_url}}/api/auth",
        "body": {"mode": "json", "raw": "{\\"user\\":\\"admin\\",\\"pass\\":\\"secret\\"}"},
        "assertions": [
          {"type": "status_code", "operator": "equals", "expected": 200}
        ],
        "captures": [
          {"name": "auth_token", "source": "json_path", "path": "$.token"}
        ]
      },
      {
        "id": "create_item",
        "name": "Create Item (using captured token)",
        "method": "POST",
        "url": "{{base_url}}/api/items",
        "headers": [{"name": "Authorization", "value": "Bearer {{auth_token}}"}],
        "body": {"mode": "json", "raw": "{\\"name\\":\\"widget\\"}"},
        "assertions": [
          {"type": "status_code", "operator": "equals", "expected": 201},
          {"type": "json_path", "path": "$.id", "operator": "exists"}
        ]
      }
    ]
  }
}`;

const TOKEN = `# Option 1: Obtain a standard bearer token from Keycloak (dev only):
TOKEN=$(curl -s http://localhost:8080/realms/qtp/protocol/openid-connect/token \\
  -d grant_type=password -d client_id=qtp-spa \\
  -d username=admin -d password=admin | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

curl -s http://localhost:5100/qtp/api/me -H "Authorization: Bearer $TOKEN"

# Option 2: System bearer token for CI pipelines:
# Bypasses IAM and resolves to the admin user automatically.
export TOKEN="system-bearer-token"
curl -s http://localhost:5100/qtp/api/tests -H "Authorization: Bearer $TOKEN"`;

const ADAPTER = `# Adding a new adapter — e.g. gRPC, CLI tool, browser flow:

# 1. Create an adapter function under src/testkit/adapters/
#    def execute_grpc(config: dict, ctx: TestContext) -> TestResult: ...

# 2. Register its capability in src/testkit/base.py:
#    TYPE_GRPC = "grpc"
#    Add to SUPPORTED_TYPES frozenset

# 3. Map its output to TestResult (status, steps, assertions)
#    Use StepResult for individual steps, AssertionResult for checks

# 4. Dispatch it in src/execution/runner.execute_run by metadata.type:
#    elif definition.type == TYPE_GRPC:
#        result = execute_grpc(config, ctx)

# 5. Add the capability to worker config:
#    WORKER_CAPABILITIES=http,python,grpc

# 6. (Optional) Add a UI editor if it is user-configurable`;

const CI_EXAMPLE = `#!/bin/bash
# ci_smoke_tests.sh — Run all tests for a target and check results
set -euo pipefail

QTP_URL=\${QTP_URL:-http://localhost:5100/qtp}
TOKEN="system-bearer-token"
TARGET_ID=\${TARGET_ID:?"TARGET_ID required"}

echo "⏳ Triggering all tests for target $TARGET_ID..."
RESULT=$(curl -sf "$QTP_URL/api/targets/$TARGET_ID/run-all?sync=true" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"environment": "default"}')

TOTAL=$(echo "$RESULT" | jq '.runs | length')
PASSED=$(echo "$RESULT" | jq '[.runs[] | select(.status=="passed")] | length')
FAILED=$(echo "$RESULT" | jq '[.runs[] | select(.status!="passed")] | length')

echo "✅ Passed: $PASSED / $TOTAL"

if [ "$FAILED" -gt 0 ]; then
  echo "❌ $FAILED test(s) failed!"
  echo "$RESULT" | jq '.runs[] | select(.status!="passed") | {name: .test_name, status, error: .error_message}'
  exit 1
fi
echo "🎉 All tests passed!"`;

/* ─────────────── Data ─────────────── */

const SOURCES = [
  ["status_code", "The numeric HTTP status code", "equals 200"],
  ["json_path", "A value extracted by JSONPath (e.g. $.a.b[0])", "$.status equals created"],
  ["header", "A named response header (case-insensitive)", "Content-Type contains json"],
  ["body_text", "The raw response body as text", "contains OK"],
  ["response_time_ms", "Total response duration in milliseconds", "lte 800"],
  ["json_schema", "Validates parsed JSON body type", "equals object"],
];
const OPERATORS = [
  { op: "equals / not_equals", desc: "Exact match (coerced to string for comparison)" },
  { op: "contains / not_contains", desc: "Substring check (string-coerced)" },
  { op: "matches / not_matches", desc: "Regular expression test" },
  { op: "exists / not_exists", desc: "Checks presence or absence of a value" },
  { op: "gt / gte / lt / lte", desc: "Numeric comparisons (values coerced to float)" },
  { op: "length_eq / length_gte / length_lte", desc: "Length of arrays, strings, or objects" },
  { op: "in / not_in", desc: "Membership in a set of allowed values" },
];

const ENDPOINTS_HEALTH = [
  ["GET", "/health", "—", "Combined health: API + DB connectivity"],
  ["GET", "/liveness", "—", "Kubernetes-style liveness probe"],
  ["GET", "/readiness", "—", "Kubernetes-style readiness probe"],
];
const ENDPOINTS_AUTH = [
  ["GET", "/api/me", "Bearer JWT", "Current user identity, roles, and admin status"],
];
const ENDPOINTS_TARGETS = [
  ["GET", "/api/targets", "Bearer JWT", "List all targets (paginated, filterable, sortable)"],
  ["POST", "/api/targets", "Bearer JWT", "Register a new target application"],
  ["GET", "/api/targets/{id}", "Bearer JWT", "Target detail with test counts and run statistics"],
  ["PATCH", "/api/targets/{id}", "Bearer JWT", "Update a target's name, URL, or environment"],
  ["GET", "/api/targets/{id}/tests", "Bearer JWT", "List tests linked to this target (paginated)"],
  ["GET", "/api/targets/{id}/runs", "Bearer JWT", "List runs for this target (paginated)"],
  ["GET", "/api/targets/{id}/stats", "Bearer JWT", "Charts: trend, duration, defects, latest per test"],
  ["POST", "/api/targets/{id}/run-all", "Bearer JWT", "Enqueue runs for every test linked to this target"],
];
const ENDPOINTS_TESTS = [
  ["GET", "/api/tests", "Bearer JWT", "List/filter test definitions (paginated, sortable)"],
  ["GET", "/api/tests/{id}", "Bearer JWT", "Full test detail: revisions, config, source code, target"],
  ["POST", "/api/tests/discover", "Bearer JWT", "Import code-based tests from tests/automations/"],
  ["POST", "/api/tests/{id}/run", "Bearer JWT", "Run a test on demand → returns queued RunSummary"],
  ["PUT", "/api/tests/{id}/tags", "Bearer JWT", "Replace the tag set for a test definition"],
  ["GET", "/api/tests/{id}/comments", "Bearer JWT", "List comments on a test definition"],
  ["POST", "/api/tests/{id}/comments", "Bearer JWT", "Add a comment (with optional tags) to a test"],
];
const ENDPOINTS_REQUEST = [
  ["POST", "/api/request-tests/send", "Bearer JWT", "Send an unsaved request and get inline results"],
  ["POST", "/api/request-tests", "Bearer JWT", "Save a request (single or multi-step) as a managed test"],
  ["PATCH", "/api/request-tests/{id}", "Bearer JWT", "Update name and/or config of a saved request test"],
  ["DELETE", "/api/request-tests/{id}", "Bearer JWT", "Delete a request test (cascades runs/schedules)"],
];
const ENDPOINTS_RUNS = [
  ["GET", "/api/runs", "Bearer JWT", "Search runs (paginated, filterable by status/target/defect/etc.)"],
  ["GET", "/api/runs/{id}", "Bearer JWT", "Full run detail: steps, assertions, response, metrics"],
  ["GET", "/api/runs/{id}/logs", "Bearer JWT", "Structured execution logs for a run"],
  ["POST", "/api/runs/{id}/cancel", "Bearer JWT", "Request cancellation of a queued or running run"],
  ["PUT", "/api/runs/{id}/defect", "Bearer JWT", "Set the defect type (triage) on a failed run"],
  ["GET", "/api/runs/{id}/comments", "Bearer JWT", "List comments on a run"],
  ["POST", "/api/runs/{id}/comments", "Bearer JWT", "Add a comment (with optional tags) to a run"],
];
const ENDPOINTS_SCHEDULES = [
  ["GET", "/api/schedules", "Bearer JWT", "List all schedules (paginated)"],
  ["GET", "/api/schedules/{id}", "Bearer JWT", "Schedule detail"],
  ["POST", "/api/schedules", "Bearer JWT", "Create a schedule (once / interval / cron)"],
  ["PATCH", "/api/schedules/{id}", "Bearer JWT", "Update schedule parameters or enable/disable"],
  ["DELETE", "/api/schedules/{id}", "Bearer JWT", "Delete a schedule"],
];
const ENDPOINTS_DASH = [
  ["GET", "/api/dashboards/overview", "Bearer JWT", "KPIs, trend, p50/p95, per-target health, backlog"],
  ["GET", "/api/dashboards/failures", "Bearer JWT", "Failure signatures, defect distribution, recent failures"],
];
const ENDPOINTS_MISC = [
  ["GET", "/api/workers", "Bearer JWT", "List all worker nodes with status, heartbeat, capabilities"],
  ["GET", "/api/tags", "Bearer JWT", "List all user-defined tags (with optional search)"],
  ["GET", "/api/projects", "Bearer JWT", "List projects (currently single-project)"],
];

const ENV_VARS = [
  ["DATABASE_URL", "postgresql+psycopg2://qtp:qtp@localhost:5432/qtp", "PostgreSQL connection string"],
  ["API_PORT", "5100", "Port the API server listens on"],
  ["ROLE", "api", "Process role: api, worker, or scheduler"],
  ["KEYCLOAK_PUBLIC_URL", "http://localhost:8080", "Keycloak URL as seen by the browser"],
  ["KEYCLOAK_INTERNAL_URL", "http://localhost:8080", "Keycloak URL for internal JWKS fetch (Docker DNS)"],
  ["KEYCLOAK_REALM", "qtp", "Keycloak realm name"],
  ["KEYCLOAK_SPA_CLIENT_ID", "qtp-spa", "OIDC client ID for the SPA"],
  ["AUTH_DISABLED", "false", "Bypass Keycloak with a synthetic admin (dev only)"],
  ["WORKER_NAME", "qtp-worker-1", "Unique name for a worker instance"],
  ["WORKER_CAPABILITIES", "http,python", "Comma-separated adapter capabilities"],
  ["WORKER_POLL_SECONDS", "1.0", "How often the worker checks for queued runs"],
  ["WORKER_HEARTBEAT_SECONDS", "5.0", "Heartbeat interval"],
  ["WORKER_STALE_SECONDS", "30.0", "Mark a worker as stale after this silence"],
  ["SCHEDULER_POLL_SECONDS", "2.0", "How often the scheduler checks for due schedules"],
  ["SSRF_BLOCK_PRIVATE", "true", "Block HTTP requests to private/loopback/link-local IPs"],
  ["SSRF_ALLOWLIST", "", "Comma-separated hosts/CIDRs exempt from SSRF blocking"],
  ["REQUEST_MAX_TIMEOUT_MS", "60000", "Maximum timeout for a single HTTP request step"],
  ["REQUEST_MAX_BODY_BYTES", "5242880", "Maximum response body capture size (5 MB)"],
  ["REQUEST_MAX_REDIRECTS", "5", "Maximum number of HTTP redirects to follow"],
  ["ALLOWED_ORIGINS", "http://localhost:5173", "CORS allowed origins for the API"],
  ["ENABLE_TRACING", "false", "Enable OpenTelemetry tracing spans"],
  ["OTLP_ENDPOINT", "http://localhost:4317", "OTLP gRPC endpoint for trace export"],
  ["SECRET_ENCRYPTION_KEY", "(fallback)", "32-byte key for encrypting stored secrets"],
  ["LOG_LEVEL", "INFO", "Python logging level (DEBUG, INFO, WARNING, ERROR)"],
];

const DEFECT_TYPES = [
  ["product_bug", "A genuine bug in the application under test"],
  ["automation_bug", "The test itself is flawed (wrong assertion, stale selector, etc.)"],
  ["system_issue", "Infrastructure / environment problem (network, DNS, DB down)"],
  ["to_investigate", "Default — needs human review to classify"],
  ["no_defect", "Expected behavior; the test's expectation was wrong"],
];

/* ─────────────── Component ─────────────── */

export default function DocsPage() {
  const { hash } = useLocation();
  const [activeApiTab, setActiveApiTab] = useState("health");

  useEffect(() => {
    if (hash) {
      setTimeout(() => {
        const id = hash.replace('#', '');
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [hash]);

  const anchorItems = [
    { key: "overview", href: "#overview", title: "Platform Overview" },
    { key: "architecture", href: "#architecture", title: "Architecture" },
    { key: "domain-model", href: "#domain-model", title: "Domain Model" },
    { key: "two-ways", href: "#two-ways", title: "Two Ways to Add a Test" },
    {
      key: "python", href: "#python", title: "Python Test SDK",
      children: [
        { key: "lifecycle", href: "#lifecycle", title: "Lifecycle Hooks" },
        { key: "metadata", href: "#metadata", title: "TestMetadata" },
        { key: "context", href: "#context", title: "TestContext" },
        { key: "result-model", href: "#result-model", title: "TestResult" },
      ],
    },
    { key: "register", href: "#register", title: "Discovery" },
    {
      key: "ui", href: "#ui", title: "Request Builder",
      children: [
        { key: "single-request", href: "#single-request", title: "Single Request" },
        { key: "multi-step", href: "#multi-step", title: "Multi-Step Flows" },
      ],
    },
    { key: "env-vars", href: "#env-vars", title: "Variables, Secrets & Captures" },
    { key: "run", href: "#run", title: "Running Tests" },
    { key: "schedule", href: "#schedule", title: "Scheduling" },
    { key: "workers", href: "#workers", title: "Worker Architecture" },
    { key: "execution-model", href: "#execution-model", title: "Execution Model" },
    { key: "assertions", href: "#assertions", title: "Assertion Catalogue" },
    { key: "failures", href: "#failures", title: "Failure Classification" },
    { key: "security", href: "#security", title: "Security" },
    { key: "extend", href: "#extend", title: "Extending the Platform" },
    { key: "ci-cd", href: "#ci-cd", title: "CI/CD Integration" },
    { key: "api", href: "#api", title: "API Reference" },
    { key: "config-ref", href: "#config-ref", title: "Configuration Reference" },
    { key: "troubleshooting", href: "#troubleshooting", title: "Troubleshooting" },
  ];

  return (
    <Row gutter={24}>
      <Col xs={0} lg={5}>
        <Anchor
          style={{ position: "sticky", top: 20, maxHeight: "calc(100vh - 40px)", overflow: "auto" }}
          onClick={(e, link) => {
            e.preventDefault();
            const id = link.href.replace('#', '');
            const element = document.getElementById(id);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth' });
              window.history.pushState(null, '', link.href);
            }
          }}
          items={anchorItems}
        />
      </Col>
      <Col xs={24} lg={19}>
        <Typography style={{ maxWidth: 920 }}>
          <Title level={2}>Developer Guide</Title>
          <Paragraph type="secondary" style={{ fontSize: 16 }}>
            Comprehensive reference for building, running, and operating automated tests with the
            QSINT Testing Platform (QTP). Covers the Python test SDK, the Request Builder,
            the execution engine, the API, CI/CD integration, and platform extension points.
          </Paragraph>

          {/* ══════════════ 1. PLATFORM OVERVIEW ══════════════ */}
          <SectionHeader id="overview" icon={<RocketOutlined />} title="Platform Overview" />
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>
              <Text strong>QTP</Text> (QSINT Testing Platform) is a full-stack automation testing platform
              that combines two capabilities that traditionally require separate tools:
            </Paragraph>
            <Paragraph>
              <ul>
                <li>
                  <Text strong>Testkube-style execution</Text> — a control plane that owns test definitions,
                  schedules, a durable PostgreSQL run queue, and capability-aware workers that execute tests.
                  HTTP adapters are built in; Playwright, Selenium, and CLI adapters are pluggable.
                </li>
                <li>
                  <Text strong>ReportPortal-style reporting</Text> — a centralized store of every run with
                  execution history, KPI dashboards, failure grouping (signatures), and defect-type triage
                  (product_bug, automation_bug, system_issue, to_investigate, no_defect).
                </li>
              </ul>
            </Paragraph>
            <Paragraph>
              Tests target applications <Text strong>by URL</Text> — meaning the same test definition
              can run against dev, staging, and production simply by changing which target it points to.
            </Paragraph>
            <Alert type="info" showIcon style={{ marginTop: 12 }}
              message="Philosophy"
              description="QTP asserts on the output, not just the status code. Every test can verify response bodies via JSONPath, headers, timing, regex patterns, and more — both from Python code and from the no-code Request Builder." />
          </Card>

          {/* ══════════════ 2. ARCHITECTURE ══════════════ */}
          <SectionHeader id="architecture" icon={<CloudServerOutlined />} title="Architecture" />
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>
              QTP follows a <Text strong>decoupled, queue-based architecture</Text> with clearly separated concerns:
            </Paragraph>
            <Code>{`Browser (React + Ant Design, Keycloak OIDC login via PKCE)
   │  JSON/REST API, JWT Bearer tokens
   ▼
┌─────────────────────────────────────────────────────────┐
│  API Server (Flask via QF FrameworkApp)                  │
│  ├─ Dynamic endpoints from maps/endpoint.json (35 routes)│
│  ├─ Keycloak JWT verification (JWKS, public/internal)   │
│  ├─ CORS + correlation-id middleware                    │
│  └─ Enqueues runs into PostgreSQL                       │
└────────────┬────────────────────────────────────────────┘
             │
   ┌─────────▼──────────┐
   │  PostgreSQL 17      │  ← definitions, targets, schedules,
   │  (durable run queue)│    queue, runs, logs, metrics,
   └─────────┬──────────┘    failure signatures, audit events
             │
   ┌─────────▼──────────────────────────────────────────────┐
   │  Worker(s)                                              │
   │  ├─ Claims runs via FOR UPDATE SKIP LOCKED             │
   │  ├─ Capability-aware: only picks up matching types     │
   │  ├─ Executes adapters (HTTP, Python, stubs for others) │
   │  ├─ Persists steps, assertions, logs, response         │
   │  └─ Heartbeat + stale-worker reaping                   │
   └────────────────────────────────────────────────────────┘
   ┌────────────────────────────────────────────────────────┐
   │  Scheduler                                              │
   │  ├─ Polls for due schedules (once / interval / cron)   │
   │  ├─ Enqueues run intents atomically                    │
   │  └─ Never executes tests — only the worker does        │
   └────────────────────────────────────────────────────────┘

Target Applications (addressed by URL; demo = httpbin)`}</Code>
            <Divider orientation="left">Technology Stack</Divider>
            <Paragraph>
              <ul>
                <li><Text strong>Frontend:</Text> React 18, TypeScript, Vite, Ant Design 5, React Query, React Router 6, React Flow, keycloak-js</li>
                <li><Text strong>Backend:</Text> Python 3, Flask (via QF FrameworkApp), SQLAlchemy 2, Alembic, psycopg2, croniter, python-dotenv</li>
                <li><Text strong>Auth:</Text> Keycloak 26.1 (OIDC/PKCE), JWT verification via JWKS, role-based access</li>
                <li><Text strong>Database:</Text> PostgreSQL 17 — used for everything including the durable run queue</li>
                <li><Text strong>Infrastructure:</Text> Docker Compose, nginx (frontend serving), OpenTelemetry (optional tracing)</li>
              </ul>
            </Paragraph>
            <Divider orientation="left">Service Topology</Divider>
            <Table size="small" pagination={false} rowKey="service"
              dataSource={[
                { service: "postgres", port: 5432, description: "PostgreSQL 17 — all platform data" },
                { service: "keycloak", port: 8080, description: "Identity provider (realm auto-imported)" },
                { service: "httpbin", port: 8088, description: "Demo target application (go-httpbin)" },
                { service: "init", port: "—", description: "One-shot: creates tables + seeds test data" },
                { service: "api", port: 5100, description: "Flask API server (35 endpoints under /qtp)" },
                { service: "worker", port: "—", description: "Execution worker (claims + runs tests)" },
                { service: "scheduler", port: "—", description: "Enqueues due schedules (never executes)" },
                { service: "frontend", port: 5173, description: "React SPA served by nginx" },
              ]}
              columns={[
                { title: "Service", dataIndex: "service", render: (v: string) => <Text code>{v}</Text> },
                { title: "Port", dataIndex: "port", width: 80 },
                { title: "Description", dataIndex: "description" },
              ]} />
          </Card>

          {/* ══════════════ 3. DOMAIN MODEL ══════════════ */}
          <SectionHeader id="domain-model" icon={<ExperimentOutlined />} title="Domain Model" />
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>
              Understanding these core entities is essential before writing or configuring tests:
            </Paragraph>
            <Collapse
              items={[
                {
                  key: "target",
                  label: <Text strong>Target</Text>,
                  children: <Paragraph>
                    An <Text strong>application under test</Text>, identified by a unique key and addressed by
                    its <Text code>base_url</Text>. Tests reference a target key, and the URL is resolved at
                    run time — enabling the same test to run against dev, staging, or production simply by
                    changing the target. Targets also support optional <Text code>health_url</Text>,
                    environment labels, default headers, and tags.
                  </Paragraph>,
                },
                {
                  key: "testdef",
                  label: <Text strong>Test Definition</Text>,
                  children: <Paragraph>
                    The stable identity of a test: its <Text code>key</Text> (unique), name, type (http_request,
                    python_script, etc.), source (code or ui_request), owner, and target reference.
                    A definition can have many <Text strong>Revisions</Text>.
                  </Paragraph>,
                },
                {
                  key: "revision",
                  label: <Text strong>Test Revision</Text>,
                  children: <Paragraph>
                    An <Text strong>immutable snapshot</Text> of a test's code reference or request config.
                    Discovery creates a new revision only when something actually changed. Runs are always
                    pinned to a specific revision, ensuring reproducibility.
                  </Paragraph>,
                },
                {
                  key: "run",
                  label: <Text strong>Run</Text>,
                  children: <Paragraph>
                    A single execution of a test definition against a target. Each run produces
                    {" "}<Text strong>steps</Text> (ordered actions), <Text strong>assertions</Text> (pass/fail checks),
                    structured <Text strong>logs</Text>, a captured <Text strong>response</Text>,
                    and a final status: <Tag color="green">passed</Tag> <Tag color="red">failed</Tag>{" "}
                    <Tag color="orange">error</Tag> <Tag>timeout</Tag> <Tag>canceled</Tag> <Tag>skipped</Tag>.
                    A run can be triggered manually, by schedule, or from the API.
                  </Paragraph>,
                },
                {
                  key: "failure-sig",
                  label: <Text strong>Failure Signature</Text>,
                  children: <Paragraph>
                    When a run fails, QTP computes a deterministic hash from the test ID, error category,
                    and a normalized error message (UUIDs and numbers replaced with placeholders). This groups
                    equivalent failures across runs so you can see recurrence patterns and triage once
                    for all occurrences.
                  </Paragraph>,
                },
                {
                  key: "defect-type",
                  label: <Text strong>Defect Type</Text>,
                  children: <Paragraph>
                    A human-assigned classification layered on top of failure signatures. When you triage a
                    failure as <Text code>product_bug</Text>, that label is remembered by the signature —
                    the next time the same signature appears, QTP auto-suggests the same defect type.
                  </Paragraph>,
                },
                {
                  key: "schedule",
                  label: <Text strong>Schedule</Text>,
                  children: <Paragraph>
                    A recurring trigger for a test. Supports three recurrence types:
                    {" "}<Text code>once</Text> (run at a specific time), <Text code>interval</Text> (every N seconds),
                    and <Text code>cron</Text> (standard 5-field cron with timezone). Schedules can be enabled/disabled
                    independently. The scheduler process enqueues due runs; it never executes tests.
                  </Paragraph>,
                },
                {
                  key: "worker-entity",
                  label: <Text strong>Worker</Text>,
                  children: <Paragraph>
                    An execution agent that registers with the platform, advertises its capabilities (e.g.
                    {" "}<Text code>http,python</Text>), and claims matching runs from the queue. Workers send
                    periodic heartbeats; stale workers are reaped and their runs marked as{" "}
                    <Text code>error/worker_lost</Text>.
                  </Paragraph>,
                },
              ]}
            />
          </Card>

          {/* ══════════════ 4. TWO WAYS ══════════════ */}
          <SectionHeader id="two-ways" icon={<CodeOutlined />} title="Two Ways to Add a Test" />
          <Card style={{ marginBottom: 20 }}>
            <Table size="small" pagination={false} rowKey="aspect"
              dataSource={[
                { aspect: "Authoring", code: "Python class in tests/automations/", ui: "Postman-like Request Builder in the web UI" },
                { aspect: "Power", code: "Full lifecycle (setup/execute/cleanup/teardown), arbitrary logic", ui: "HTTP requests with assertions — no code required" },
                { aspect: "Multi-step", code: "Orchestrate in execute() with custom logic", ui: "Toggle 'Multi-step Flow', chain requests with captures" },
                { aspect: "Assertions", code: "Programmable + declarative (via config)", ui: "Visual assertion builder on response body/headers/timing" },
                { aspect: "Storage", code: "Lives in the repo under tests/automations/, imported by discovery", ui: "Saved in the database as a managed test" },
                { aspect: "Runs", code: "On demand, scheduled, or via API", ui: "On demand, scheduled, or via API" },
                { aspect: "Target resolution", code: "Via TestContext — {{base_url}} resolved at run time", ui: "Select target from dropdown or type absolute URL" },
                { aspect: "Source visibility", code: "Reflected Python source visible on Test Detail page", ui: "Config visible as JSON on Test Detail page" },
              ]}
              columns={[
                { title: "Aspect", dataIndex: "aspect", width: 130, render: (v: string) => <Text strong>{v}</Text> },
                { title: "Python Code Tests", dataIndex: "code" },
                { title: "UI Request Tests", dataIndex: "ui" },
              ]} />
            <Paragraph style={{ marginTop: 12 }}>
              Both methods address a target by URL, support the same assertion engine, and can be run
              on demand or on a schedule. Choose Python for complex workflows and the Request Builder
              for quick HTTP validation.
            </Paragraph>
          </Card>

          {/* ══════════════ 5. PYTHON SDK ══════════════ */}
          <SectionHeader id="python" icon={<CodeOutlined />} title="Python Test SDK" />

          <Card id="lifecycle" title="Lifecycle Hooks" style={{ marginBottom: 20 }}>
            <Paragraph>
              Subclass <Text code>BaseAutomationTest</Text>, declare <Text code>TestMetadata</Text>, and implement
              the hooks you need. The framework calls them in strict order:
            </Paragraph>
            <Code>{`validate_config(config)  →  setup(ctx)  →  execute(ctx)  →  cleanup(ctx)  →  teardown(ctx)
         │                    │              │ (required)       │                  │
         │                    │              │                  │                  │
    Check config         Seed data,     Run the test,      Undo data         Release
    shape/values      resolve deps    return TestResult   test created     resources
                                                        (even on failure)  (sessions,
                                                                           drivers)`}</Code>
            <Alert type="info" showIcon style={{ marginTop: 12, marginBottom: 12 }}
              message="cleanup() vs teardown()"
              description={<>
                <Text strong>cleanup()</Text> reverts data the test created on the <em>application under test</em>{" "}
                (e.g. DELETE a resource a POST created), so mutating tests don't leak state between runs.
                <br /><br />
                <Text strong>teardown()</Text> releases resources the <em>test itself</em> held (sessions, browser
                drivers, temp files). Both always run, even when execute() raised an exception. A failure
                in cleanup/teardown is logged but does not change the test's pass/fail status.
                <br /><br />
                A read-only GET test implements <em>neither</em>.
              </>} />
            <Title level={5}>Minimal Example (read-only GET)</Title>
            <Code>{PY_SIMPLE}</Code>
            <Title level={5} style={{ marginTop: 16 }}>Full Example (mutating POST with cleanup)</Title>
            <Code>{PY_TEST}</Code>
          </Card>

          <Card id="metadata" title="TestMetadata Fields" style={{ marginBottom: 20 }}>
            <Table size="small" pagination={false} rowKey="field"
              dataSource={[
                { field: "key", type: "str", required: "✓", desc: "Unique identifier across all tests (e.g. 'api.create_order'). Used as the stable identity for discovery upserts." },
                { field: "name", type: "str", required: "✓", desc: "Human-readable display name shown in the Test Catalog." },
                { field: "type", type: "str", required: "✓", desc: "Adapter type: http_request, python_script, playwright, selenium, cli" },
                { field: "tags", type: "list[str]", required: "", desc: "Arbitrary tags for filtering and organization (e.g. ['api', 'smoke'])" },
                { field: "owner", type: "str | None", required: "", desc: "Username of the test author or owning team" },
                { field: "target", type: "str", required: "", desc: "Key of the target application. Default: 'default'" },
                { field: "default_config", type: "dict", required: "", desc: "Default configuration passed to the adapter (method, URL, headers, body, assertions)" },
              ]}
              columns={[
                { title: "Field", dataIndex: "field", render: (v: string) => <Text code>{v}</Text> },
                { title: "Type", dataIndex: "type", width: 120 },
                { title: "Req.", dataIndex: "required", width: 40 },
                { title: "Description", dataIndex: "desc" },
              ]} />
          </Card>

          <Card id="context" title="TestContext" style={{ marginBottom: 20 }}>
            <Paragraph>
              Every test receives a <Text code>TestContext</Text> instance with access to the resolved target,
              variables, secrets, and structured logging:
            </Paragraph>
            <Table size="small" pagination={false} rowKey="method"
              dataSource={[
                { method: "ctx.target(key)", desc: "Returns the ResolvedTarget (key, base_url, default_headers) for the given target key." },
                { method: "ctx.variables", desc: "Dict of all resolved variables. Includes base_url and any captured values from prior steps." },
                { method: "ctx.set_var(name, value)", desc: "Inject a variable into the context for use in subsequent {{var}} templates." },
                { method: "ctx.get_var(name, default)", desc: "Read a variable by name with an optional default." },
                { method: "ctx.render(text)", desc: "Substitute all {{var}} and {{secret}} tokens in a string." },
                { method: "ctx.secrets", desc: "Dict of decrypted secrets for the project. Values are auto-redacted in logs." },
                { method: "ctx.log(level, message)", desc: "Emit a structured log entry (persisted with the run)." },
                { method: "ctx.should_cancel()", desc: "Check if cancellation has been requested for this run." },
                { method: "ctx.correlation_id", desc: "Unique correlation ID for distributed tracing of this execution." },
              ]}
              columns={[
                { title: "Method / Property", dataIndex: "method", render: (v: string) => <Text code>{v}</Text> },
                { title: "Description", dataIndex: "desc" },
              ]} />
          </Card>

          <Card id="result-model" title="TestResult" style={{ marginBottom: 20 }}>
            <Paragraph>
              <Text code>execute()</Text> must return a <Text code>TestResult</Text> that the framework persists:
            </Paragraph>
            <Table size="small" pagination={false} rowKey="field"
              dataSource={[
                { field: "status", type: "str", desc: "Terminal status: passed, failed, error, timeout, canceled, skipped" },
                { field: "steps", type: "list[StepResult]", desc: "Ordered steps (each with name, status, duration_ms, optional error)" },
                { field: "assertions", type: "list[AssertionResult]", desc: "Assertion outcomes (source, operator, expected, actual, passed, message)" },
                { field: "error_category", type: "str | None", desc: "Machine-readable error category for failure classification" },
                { field: "error_message", type: "str | None", desc: "Human-readable error description" },
                { field: "response", type: "dict", desc: "Captured HTTP response summary (status_code, headers, body_text, elapsed_ms)" },
                { field: "metrics", type: "dict", desc: "Free-form metrics (elapsed_ms is auto-populated)" },
              ]}
              columns={[
                { title: "Field", dataIndex: "field", render: (v: string) => <Text code>{v}</Text> },
                { title: "Type", dataIndex: "type", width: 160 },
                { title: "Description", dataIndex: "desc" },
              ]} />
          </Card>

          {/* ══════════════ 6. DISCOVERY ══════════════ */}
          <SectionHeader id="register" icon={<ExperimentOutlined />} title="Test Discovery" />
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>
              QTP <Text strong>automatically discovers</Text> code-based tests by recursively scanning
              the <Text code>backend/tests/automations/</Text> directory tree. No manual module registration
              is required — just place your Python file anywhere under that directory.
            </Paragraph>
            <Paragraph>
              <Text strong>How it works:</Text>
              <ol>
                <li>The discovery engine recursively finds all <Text code>*.py</Text> files under <Text code>tests/automations/</Text> (skipping <Text code>__init__.py</Text> and files starting with <Text code>_</Text>).</li>
                <li>Each file is imported and scanned for <Text code>BaseAutomationTest</Text> subclasses.</li>
                <li>For each valid class, it upserts a <Text code>TestDefinition</Text> by <Text code>metadata.key</Text>.</li>
                <li>A new immutable <Text code>Revision</Text> is created only when the code reference or default config actually changed.</li>
                <li>Tests that were previously discovered but no longer exist in source are marked <Text code>missing_from_source</Text> — they are never deleted.</li>
              </ol>
            </Paragraph>
            <Code>{DISCOVER}</Code>
            <Alert type="warning" showIcon style={{ marginTop: 12 }}
              message="Duplicate Keys"
              description={<>
                Every test <Text code>metadata.key</Text> must be globally unique. Discovery will
                raise a <Text code>ValidationError</Text> if two classes share the same key.
              </>} />
          </Card>

          {/* ══════════════ 7. REQUEST BUILDER ══════════════ */}
          <SectionHeader id="ui" icon={<ApiOutlined />} title="Request Builder" />

          <Card id="single-request" title="Single Request Mode" style={{ marginBottom: 20 }}>
            <Paragraph>
              The <Text strong>Request Builder</Text> is a Postman/Insomnia-style editor built into QTP.
              It lets you compose HTTP requests visually without writing code:
            </Paragraph>
            <Paragraph>
              <ol>
                <li>Open <Text strong>Request Builder</Text> from the sidebar.</li>
                <li>Select a <Text strong>Target</Text> from the dropdown (resolves <Text code>{"{{base_url}}"}</Text>) or type an absolute URL.</li>
                <li>Set <Text strong>method</Text>, <Text strong>URL</Text>, <Text strong>headers</Text>, <Text strong>query params</Text>, and <Text strong>body</Text>.</li>
                <li>Add <Text strong>assertions</Text> on the response (status code, JSON path, headers, body text, response time).</li>
                <li>Click <Text strong>Send</Text> to execute immediately and see inline results.</li>
                <li>Click <Text strong>Save</Text> to persist as a managed test definition.</li>
                <li>Optionally <Text strong>Schedule</Text> it directly from the builder.</li>
              </ol>
            </Paragraph>
            <Paragraph>
              The left sidebar shows <Text strong>saved requests</Text> — click one to load, edit, then Update.
              Requests can be <Text strong>deleted</Text> (cascades to all runs, schedules, and revisions).
            </Paragraph>
            <Paragraph>Equivalent API call for a single request:</Paragraph>
            <Code>{SAVE_UI}</Code>
          </Card>

          <Card id="multi-step" title="Multi-Step Flows" style={{ marginBottom: 20 }}>
            <Paragraph>
              Toggle <Text strong>Multi-step Flow</Text> in the Request Builder to chain multiple sequential
              HTTP requests. This enables common patterns like:
            </Paragraph>
            <Paragraph>
              <ul>
                <li><Text strong>Auth → API call</Text>: Authenticate, capture a token, use it in subsequent requests</li>
                <li><Text strong>CRUD sequences</Text>: Create → Read → Update → Delete a resource</li>
                <li><Text strong>Workflow validation</Text>: Step through a multi-stage business process</li>
              </ul>
            </Paragraph>
            <Paragraph>
              Key features of multi-step flows:
              <ul>
                <li><Text strong>Sequential execution</Text> — steps run in order; a step failure halts the flow</li>
                <li><Text strong>Captures</Text> — extract values from one step's response (via JSONPath) and inject them as variables for subsequent steps</li>
                <li><Text strong>Per-step assertions</Text> — each step has its own assertion set</li>
                <li><Text strong>Visual step editor</Text> — add, duplicate, reorder, and delete steps with drag-and-drop</li>
                <li><Text strong>React Flow visualization</Text> — the Test Detail page shows a step flow diagram with run-context coloring</li>
              </ul>
            </Paragraph>
            <Code>{SAVE_UI_FLOW}</Code>
            <Alert type="info" showIcon style={{ marginTop: 12 }}
              message="Single-Request Backward Compatibility"
              description="Tests with a single request (no config.steps array) continue to work unchanged. The system auto-detects whether a request test is single-step or multi-step based on the presence of the steps array." />
          </Card>

          {/* ══════════════ 8. VARIABLES ══════════════ */}
          <SectionHeader id="env-vars" icon={<SettingOutlined />} title="Variables, Secrets & Captures" />
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>
              QTP supports <Text code>{"{{variable_name}}"}</Text> interpolation across URLs, headers, query
              parameters, and request bodies — in both Python tests and Request Builder flows.
            </Paragraph>
            <Divider orientation="left">Built-in Variables</Divider>
            <Table size="small" pagination={false} rowKey="var"
              dataSource={[
                { var: "{{base_url}}", desc: "Resolves to the target's base URL. Makes tests portable across environments." },
              ]}
              columns={[
                { title: "Variable", dataIndex: "var", render: (v: string) => <Text code>{v}</Text> },
                { title: "Description", dataIndex: "desc" },
              ]} />
            <Divider orientation="left">Captures (Multi-Step Flows)</Divider>
            <Paragraph>
              In multi-step flows, you can <Text strong>capture</Text> values from a step's response and use them
              in subsequent steps. Define a capture on a step:
            </Paragraph>
            <Code>{`// Step 1 captures:
"captures": [{"name": "auth_token", "source": "json_path", "path": "$.token"}]

// Step 2 can then reference it:
"headers": [{"name": "Authorization", "value": "Bearer {{auth_token}}"}]
// Or in the URL:
"url": "{{base_url}}/api/items/{{item_id}}"`}</Code>
            <Divider orientation="left">Secrets</Divider>
            <Paragraph>
              Secrets are stored encrypted in the database (per-project) and resolved into the{" "}
              <Text code>TestContext.secrets</Text> dict at run time. Secret values are{" "}
              <Text strong>automatically redacted</Text> from all persisted logs and artifacts.
              Reference them with the same <Text code>{"{{secret_name}}"}</Text> syntax.
            </Paragraph>
          </Card>

          {/* ══════════════ 9. RUNNING TESTS ══════════════ */}
          <SectionHeader id="run" icon={<ThunderboltOutlined />} title="Running Tests" />
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>
              Tests can be triggered in three ways:
            </Paragraph>
            <Collapse
              items={[
                {
                  key: "ui-run",
                  label: <Text strong>From the UI</Text>,
                  children: <Paragraph>
                    Click <Text strong>"Run now"</Text> on any test in the Test Catalog or Test Detail page.
                    The run is enqueued immediately and you can watch it progress on the Runs page.
                  </Paragraph>,
                },
                {
                  key: "api-run",
                  label: <Text strong>Via the API</Text>,
                  children: <><Paragraph>Use the run endpoint with a bearer token:</Paragraph><Code>{RUN_NOW}</Code></>,
                },
                {
                  key: "run-all",
                  label: <Text strong>Run All (per target)</Text>,
                  children: <><Paragraph>Enqueue runs for every test linked to a target in one call. Use <Text code>?sync=true</Text> for CI pipelines:</Paragraph><Code>{RUN_ALL}</Code></>,
                },
              ]}
            />
            <Alert type="info" showIcon style={{ marginTop: 12 }}
              message="Run Lifecycle"
              description={<>
                A run transitions through: <Tag>queued</Tag> → <Tag color="blue">claimed</Tag> → <Tag color="processing">running</Tag> → terminal status
                (<Tag color="green">passed</Tag> / <Tag color="red">failed</Tag> / <Tag color="orange">error</Tag> / <Tag>timeout</Tag> / <Tag>canceled</Tag>).
                You can cancel a queued or running test via the UI or API.
              </>} />
          </Card>

          {/* ══════════════ 10. SCHEDULING ══════════════ */}
          <SectionHeader id="schedule" icon={<ScheduleOutlined />} title="Scheduling" />
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>
              Schedules run <Text strong>independently</Text> of on-demand runs. The scheduler process
              polls for due schedules and enqueues runs automatically — it never executes tests itself.
            </Paragraph>
            <Table size="small" pagination={false} rowKey="type"
              dataSource={[
                { type: "once", desc: "Run at a specific date/time, then become inactive", example: '"run_at": "2025-03-01T09:00:00Z"' },
                { type: "interval", desc: "Run every N seconds", example: '"interval_seconds": 300' },
                { type: "cron", desc: "Standard 5-field cron expression with timezone", example: '"cron_expression": "0 9 * * 1-5", "timezone": "UTC"' },
              ]}
              columns={[
                { title: "Type", dataIndex: "type", render: (v: string) => <Tag>{v}</Tag> },
                { title: "Description", dataIndex: "desc" },
                { title: "Config", dataIndex: "example", render: (v: string) => <Text code>{v}</Text> },
              ]} />
            <Code>{SCHED}</Code>
            <Paragraph style={{ marginTop: 12 }}>
              Schedules can be <Text strong>enabled/disabled</Text> without deleting them, and managed from both
              the Schedules page and the Schedule Detail page.
            </Paragraph>
          </Card>

          {/* ══════════════ 11. WORKER ARCHITECTURE ══════════════ */}
          <SectionHeader id="workers" icon={<ClusterOutlined />} title="Worker Architecture" />
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>
              QTP's execution is fully <Text strong>decoupled</Text> from the API server. The API enqueues runs
              into PostgreSQL; workers pull and execute them independently.
            </Paragraph>
            <Divider orientation="left">How Workers Operate</Divider>
            <Paragraph>
              <ol>
                <li><Text strong>Registration</Text> — on startup, a worker registers itself with a unique name and its list of capabilities.</li>
                <li><Text strong>Polling</Text> — the worker polls the run queue every <Text code>WORKER_POLL_SECONDS</Text> (default: 1s).</li>
                <li><Text strong>Claiming</Text> — uses <Text code>SELECT ... FOR UPDATE SKIP LOCKED</Text> to atomically claim one queued run that matches its capabilities. This ensures no two workers process the same run, even at scale.</li>
                <li><Text strong>Execution</Text> — the worker builds a <Text code>TestContext</Text>, resolves the target, and dispatches to the appropriate adapter (HTTP, Python code test, or stub for unimplemented types).</li>
                <li><Text strong>Persistence</Text> — steps, assertions, logs, response body, and metrics are all written back to PostgreSQL.</li>
                <li><Text strong>Failure classification</Text> — for failed/error/timeout runs, the worker computes a failure signature and auto-suggests a defect type.</li>
                <li><Text strong>Heartbeat</Text> — the worker sends heartbeats every <Text code>WORKER_HEARTBEAT_SECONDS</Text>. If a worker stops sending heartbeats for longer than <Text code>WORKER_STALE_SECONDS</Text>, its in-progress runs are marked <Text code>error/worker_lost</Text>.</li>
              </ol>
            </Paragraph>
            <Divider orientation="left">Capability-Aware Routing</Divider>
            <Paragraph>
              Workers advertise capabilities like <Text code>http,python</Text>. The queue matches each run's required
              capability (derived from the test's type) against available workers. This means you can deploy
              specialized workers — e.g. a worker with <Text code>playwright</Text> capability on a machine with
              browser binaries.
            </Paragraph>
            <Divider orientation="left">Scaling</Divider>
            <Paragraph>
              Scale horizontally by adding more worker containers (each with a unique <Text code>WORKER_NAME</Text>).
              The <Text code>SKIP LOCKED</Text> queue ensures work is distributed without conflicts. View all
              active workers and their status on the <Text strong>Workers</Text> dashboard.
            </Paragraph>
          </Card>

          {/* ══════════════ 12. EXECUTION MODEL ══════════════ */}
          <SectionHeader id="execution-model" icon={<ThunderboltOutlined />} title="Execution Model" />
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>
              The execution model determines how a test run is processed from queue to completion:
            </Paragraph>
            <Code>{`User/Scheduler/API → Enqueue Run (status: queued)
                         │
                Worker claims via FOR UPDATE SKIP LOCKED
                         │
               ┌─────────▼──────────┐
               │  Build TestContext  │  ← resolve target URL, variables, secrets
               │  Check cancellation │  ← cooperative cancel before execution
               └─────────┬──────────┘
                         │
               ┌─────────▼──────────────────────────────┐
               │  Dispatch to adapter by type:           │
               │  ├─ code_ref → _run_code_test()         │
               │  │  (import module, instantiate,         │
               │  │   validate → setup → execute →        │
               │  │   cleanup → teardown)                 │
               │  ├─ http_request → execute_http()       │
               │  └─ other → unsupported() stub          │
               └─────────┬──────────────────────────────┘
                         │
               ┌─────────▼──────────────────────────────┐
               │  Persist Results:                       │
               │  ├─ Run status (passed/failed/error)    │
               │  ├─ Steps (ordered)                     │
               │  ├─ Assertions (per-check pass/fail)    │
               │  ├─ Logs (structured, secrets redacted) │
               │  ├─ Response (headers, body, timing)    │
               │  ├─ Metrics (elapsed_ms, etc.)          │
               │  └─ Failure signature + defect type     │
               └────────────────────────────────────────┘`}</Code>
            <Alert type="info" showIcon style={{ marginTop: 12 }}
              message="SSRF Protection"
              description={<>
                All outbound HTTP requests go through the <Text code>net_guard</Text> module which resolves the
                target host, blocks requests to private/loopback/link-local/metadata IP ranges (169.254.169.254),
                and re-checks on every redirect hop. Hosts can be explicitly allowed via the{" "}
                <Text code>SSRF_ALLOWLIST</Text> config.
              </>} />
          </Card>

          {/* ══════════════ 13. ASSERTIONS ══════════════ */}
          <SectionHeader id="assertions" icon={<ExperimentOutlined />} title="Assertion Catalogue" />
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>
              Assertions are the core of QTP's "check the <Text strong>output</Text>, not just the status code"
              philosophy. Every assertion specifies a <Text strong>source</Text> (what to check), an{" "}
              <Text strong>operator</Text> (how to compare), and an <Text strong>expected value</Text>.
            </Paragraph>
            <Divider orientation="left">Sources</Divider>
            <Table size="small" pagination={false} rowKey={(r: any) => r[0]}
              dataSource={SOURCES}
              columns={[
                { title: "Source", width: 140, render: (_, r) => <Text code>{r[0]}</Text> },
                { title: "Description", render: (_, r) => r[1] },
                { title: "Example", render: (_, r) => <Text code>{r[2]}</Text> },
              ]} />
            <Divider orientation="left">Operators</Divider>
            <Table size="small" pagination={false} rowKey="op"
              dataSource={OPERATORS}
              columns={[
                { title: "Operator", width: 220, dataIndex: "op", render: (v: string) => <Text code>{v}</Text> },
                { title: "Description", dataIndex: "desc" },
              ]} />
            <Divider orientation="left">JSONPath Syntax</Divider>
            <Paragraph>
              QTP supports a minimal JSONPath subset for extracting values from JSON response bodies:
            </Paragraph>
            <Table size="small" pagination={false} rowKey="syntax"
              dataSource={[
                { syntax: "$", desc: "Root of the JSON document" },
                { syntax: "$.key", desc: "Direct child property" },
                { syntax: "$.a.b.c", desc: "Nested property access" },
                { syntax: "$.items[0]", desc: "Array element by index" },
                { syntax: "$['key-with-dashes']", desc: "Bracket notation for special characters" },
                { syntax: "$.users[0].name", desc: "Combined nested access" },
              ]}
              columns={[
                { title: "Syntax", dataIndex: "syntax", render: (v: string) => <Text code>{v}</Text> },
                { title: "Description", dataIndex: "desc" },
              ]} />
            <Divider orientation="left">Assertion Config Schema</Divider>
            <Code>{`{
  "type": "json_path",       // source (or "source" key)
  "path": "$.data.items",    // target path for json_path/header
  "operator": "length_gte",  // comparison operator
  "expected": 1              // expected value
}`}</Code>
          </Card>

          {/* ══════════════ 14. FAILURE CLASSIFICATION ══════════════ */}
          <SectionHeader id="failures" icon={<BugOutlined />} title="Failure Classification & Defect Triage" />
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>
              When a test fails, QTP automatically groups the failure and suggests a classification:
            </Paragraph>
            <Paragraph>
              <ol>
                <li><Text strong>Signature computation</Text> — A SHA-256 hash is computed from the test ID, error category, and a normalized error message (numbers and UUIDs replaced with placeholders). This groups "the same failure" across runs.</li>
                <li><Text strong>Auto-suggestion</Text> — If this signature has been seen before and triaged, QTP suggests the last defect type. New signatures default to <Text code>to_investigate</Text>.</li>
                <li><Text strong>Human triage</Text> — On the Run Detail page, a tester can assign one of the defect types. This "teaches" the signature so future occurrences get the same suggestion.</li>
              </ol>
            </Paragraph>
            <Divider orientation="left">Defect Types</Divider>
            <Table size="small" pagination={false} rowKey="type"
              dataSource={DEFECT_TYPES.map(([type, desc]) => ({ type, desc }))}
              columns={[
                { title: "Type", dataIndex: "type", render: (v: string) => <Tag>{v}</Tag>, width: 160 },
                { title: "Description", dataIndex: "desc" },
              ]} />
            <Paragraph style={{ marginTop: 12 }}>
              The <Text strong>Overview</Text> dashboard shows defect distribution charts and the{" "}
              <Text strong>Failures</Text> dashboard shows all unique signatures, their occurrence counts,
              and recent failures with drill-down to the relevant Run Detail page.
            </Paragraph>
          </Card>

          {/* ══════════════ 15. SECURITY ══════════════ */}
          <SectionHeader id="security" icon={<LockOutlined />} title="Security Model" />
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>
              QTP employs multiple security layers:
            </Paragraph>
            <Collapse
              items={[
                {
                  key: "auth",
                  label: <Text strong>Authentication (Keycloak OIDC)</Text>,
                  children: <Paragraph>
                    The frontend uses <Text code>keycloak-js</Text> with PKCE for login. The API validates
                    JWTs against Keycloak's JWKS endpoint. In Docker, keys are fetched internally
                    (<Text code>http://keycloak:8080</Text>) while the issuer claim matches the public URL
                    (<Text code>http://localhost:8080</Text>). Set <Text code>AUTH_DISABLED=true</Text> for
                    local development without Keycloak (creates a synthetic admin principal).
                  </Paragraph>,
                },
                {
                  key: "system-token",
                  label: <Text strong>System Bearer Token (CI)</Text>,
                  children: <Paragraph>
                    For CI pipelines where obtaining a Keycloak token is impractical, QTP accepts a hardcoded
                    {" "}<Text code>system-bearer-token</Text> that bypasses IAM and resolves to the admin user.
                    <Text type="danger"> Change or disable this in production.</Text>
                  </Paragraph>,
                },
                {
                  key: "ssrf",
                  label: <Text strong>SSRF Protection</Text>,
                  children: <Paragraph>
                    The <Text code>net_guard</Text> module prevents Server-Side Request Forgery by resolving
                    hostnames before connecting and blocking requests to private (RFC 1918), loopback,
                    link-local, and cloud metadata (169.254.169.254) IP ranges. It re-validates on every
                    redirect hop. Trusted hosts can be explicitly allowed via <Text code>SSRF_ALLOWLIST</Text>.
                  </Paragraph>,
                },
                {
                  key: "secrets",
                  label: <Text strong>Secret Redaction</Text>,
                  children: <Paragraph>
                    All secret values are automatically stripped from log messages, response bodies, and
                    artifacts before they are persisted to the database. The <Text code>TestContext._redact()</Text>{" "}
                    method handles this transparently.
                  </Paragraph>,
                },
                {
                  key: "cors",
                  label: <Text strong>CORS</Text>,
                  children: <Paragraph>
                    The API enforces CORS with <Text code>ALLOWED_ORIGINS</Text> (default: <Text code>http://localhost:5173</Text>).
                    Only the configured origins can make cross-origin requests.
                  </Paragraph>,
                },
              ]}
            />
          </Card>

          {/* ══════════════ 16. EXTEND ══════════════ */}
          <SectionHeader id="extend" icon={<ToolOutlined />} title="Extending the Platform" />
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>
              QTP's adapter architecture is designed for extensibility. To add a new test type (e.g. gRPC,
              a CLI tool, browser automation), follow these steps:
            </Paragraph>
            <Code>{ADAPTER}</Code>
            <Alert type="info" showIcon style={{ marginTop: 12 }}
              message="Built-in Adapter Types"
              description={<>
                <Tag color="green">http_request</Tag> — fully implemented with SSRF protection, redirect following, body capture, and assertion evaluation.{" "}
                <Tag>python_script</Tag> — runs via code_ref (module:ClassName).{" "}
                <Tag color="default">playwright</Tag> <Tag color="default">selenium</Tag> <Tag color="default">cli</Tag> — stubbed; return a clear ERROR with instructions to implement.
              </>} />
          </Card>

          {/* ══════════════ 17. CI/CD ══════════════ */}
          <SectionHeader id="ci-cd" icon={<SafetyOutlined />} title="CI/CD Integration" />
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>
              QTP is designed to integrate into CI/CD pipelines. Use the <Text code>system-bearer-token</Text>{" "}
              and the <Text strong>sync execution</Text> mode to block until tests complete:
            </Paragraph>
            <Divider orientation="left">Authentication for CI</Divider>
            <Code>{TOKEN}</Code>
            <Divider orientation="left">Example CI Script</Divider>
            <Code>{CI_EXAMPLE}</Code>
            <Divider orientation="left">Integration Patterns</Divider>
            <Paragraph>
              <ul>
                <li><Text strong>Smoke tests on deploy</Text> — trigger <Text code>run-all</Text> for a target after deployment, gate on results</li>
                <li><Text strong>Scheduled regression</Text> — configure cron schedules in QTP, monitor the Overview dashboard</li>
                <li><Text strong>PR validation</Text> — run specific tests from CI, fail the build on any failure</li>
                <li><Text strong>Monitoring</Text> — use interval schedules (e.g. every 5 minutes) as synthetic monitoring</li>
              </ul>
            </Paragraph>
          </Card>

          {/* ══════════════ 18. API REFERENCE ══════════════ */}
          <SectionHeader id="api" icon={<ApiOutlined />} title="API Reference" />
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>
              All endpoints live under the <Text code>/qtp</Text> namespace and require a bearer token
              (Keycloak JWT or <Text code>system-bearer-token</Text>). The base URL is{" "}
              <Text code>http://localhost:5100/qtp</Text>.
            </Paragraph>
            <Paragraph>
              Paginated list endpoints support query parameters:
              <Text code> page</Text>, <Text code>page_size</Text>, <Text code>sort</Text>, <Text code>order</Text> (asc/desc),
              <Text code> q</Text> (search), plus endpoint-specific filters.
            </Paragraph>
            <Tabs activeKey={activeApiTab} onChange={setActiveApiTab}
              items={[
                {
                  key: "health", label: "Health",
                  children: <Table size="small" pagination={false} rowKey={(r: any) => r[0]+r[1]}
                    dataSource={ENDPOINTS_HEALTH}
                    columns={[
                      { title: "Method", width: 90, render: (_, r) => <Tag>{r[0]}</Tag> },
                      { title: "Path", width: 180, render: (_, r) => <Text code>{r[1]}</Text> },
                      { title: "Auth", width: 100, render: (_, r) => r[2] },
                      { title: "Description", render: (_, r) => r[3] },
                    ]} />,
                },
                {
                  key: "auth", label: "Identity",
                  children: <Table size="small" pagination={false} rowKey={(r: any) => r[0]+r[1]}
                    dataSource={ENDPOINTS_AUTH}
                    columns={[
                      { title: "Method", width: 90, render: (_, r) => <Tag>{r[0]}</Tag> },
                      { title: "Path", width: 180, render: (_, r) => <Text code>{r[1]}</Text> },
                      { title: "Auth", width: 100, render: (_, r) => r[2] },
                      { title: "Description", render: (_, r) => r[3] },
                    ]} />,
                },
                {
                  key: "targets", label: "Targets",
                  children: <Table size="small" pagination={false} rowKey={(r: any) => r[0]+r[1]}
                    dataSource={ENDPOINTS_TARGETS}
                    columns={[
                      { title: "Method", width: 90, render: (_, r) => <Tag>{r[0]}</Tag> },
                      { title: "Path", width: 250, render: (_, r) => <Text code>{r[1]}</Text> },
                      { title: "Auth", width: 100, render: (_, r) => r[2] },
                      { title: "Description", render: (_, r) => r[3] },
                    ]} />,
                },
                {
                  key: "tests", label: "Tests",
                  children: <Table size="small" pagination={false} rowKey={(r: any) => r[0]+r[1]}
                    dataSource={ENDPOINTS_TESTS}
                    columns={[
                      { title: "Method", width: 90, render: (_, r) => <Tag>{r[0]}</Tag> },
                      { title: "Path", width: 250, render: (_, r) => <Text code>{r[1]}</Text> },
                      { title: "Auth", width: 100, render: (_, r) => r[2] },
                      { title: "Description", render: (_, r) => r[3] },
                    ]} />,
                },
                {
                  key: "requests", label: "Request Tests",
                  children: <Table size="small" pagination={false} rowKey={(r: any) => r[0]+r[1]}
                    dataSource={ENDPOINTS_REQUEST}
                    columns={[
                      { title: "Method", width: 90, render: (_, r) => <Tag>{r[0]}</Tag> },
                      { title: "Path", width: 250, render: (_, r) => <Text code>{r[1]}</Text> },
                      { title: "Auth", width: 100, render: (_, r) => r[2] },
                      { title: "Description", render: (_, r) => r[3] },
                    ]} />,
                },
                {
                  key: "runs", label: "Runs",
                  children: <Table size="small" pagination={false} rowKey={(r: any) => r[0]+r[1]}
                    dataSource={ENDPOINTS_RUNS}
                    columns={[
                      { title: "Method", width: 90, render: (_, r) => <Tag>{r[0]}</Tag> },
                      { title: "Path", width: 250, render: (_, r) => <Text code>{r[1]}</Text> },
                      { title: "Auth", width: 100, render: (_, r) => r[2] },
                      { title: "Description", render: (_, r) => r[3] },
                    ]} />,
                },
                {
                  key: "schedules", label: "Schedules",
                  children: <Table size="small" pagination={false} rowKey={(r: any) => r[0]+r[1]}
                    dataSource={ENDPOINTS_SCHEDULES}
                    columns={[
                      { title: "Method", width: 90, render: (_, r) => <Tag>{r[0]}</Tag> },
                      { title: "Path", width: 250, render: (_, r) => <Text code>{r[1]}</Text> },
                      { title: "Auth", width: 100, render: (_, r) => r[2] },
                      { title: "Description", render: (_, r) => r[3] },
                    ]} />,
                },
                {
                  key: "dashboards", label: "Dashboards",
                  children: <Table size="small" pagination={false} rowKey={(r: any) => r[0]+r[1]}
                    dataSource={ENDPOINTS_DASH}
                    columns={[
                      { title: "Method", width: 90, render: (_, r) => <Tag>{r[0]}</Tag> },
                      { title: "Path", width: 250, render: (_, r) => <Text code>{r[1]}</Text> },
                      { title: "Auth", width: 100, render: (_, r) => r[2] },
                      { title: "Description", render: (_, r) => r[3] },
                    ]} />,
                },
                {
                  key: "misc", label: "Workers / Tags / Projects",
                  children: <Table size="small" pagination={false} rowKey={(r: any) => r[0]+r[1]}
                    dataSource={ENDPOINTS_MISC}
                    columns={[
                      { title: "Method", width: 90, render: (_, r) => <Tag>{r[0]}</Tag> },
                      { title: "Path", width: 250, render: (_, r) => <Text code>{r[1]}</Text> },
                      { title: "Auth", width: 100, render: (_, r) => r[2] },
                      { title: "Description", render: (_, r) => r[3] },
                    ]} />,
                },
              ]}
            />
          </Card>

          {/* ══════════════ 19. CONFIG REFERENCE ══════════════ */}
          <SectionHeader id="config-ref" icon={<SettingOutlined />} title="Configuration Reference" />
          <Card style={{ marginBottom: 20 }}>
            <Paragraph>
              All configuration is driven by environment variables (loaded from <Text code>.env</Text> or
              the container environment). Below is the complete reference:
            </Paragraph>
            <Table size="small" pagination={false} rowKey={(r: any) => r[0]}
              dataSource={ENV_VARS}
              columns={[
                { title: "Variable", width: 220, render: (_, r) => <Text code>{r[0]}</Text> },
                { title: "Default", width: 180, render: (_, r) => <Text code style={{ fontSize: 11 }}>{r[1]}</Text> },
                { title: "Description", render: (_, r) => r[2] },
              ]} />
          </Card>

          {/* ══════════════ 20. TROUBLESHOOTING ══════════════ */}
          <SectionHeader id="troubleshooting" icon={<QuestionCircleOutlined />} title="Troubleshooting" />
          <Card style={{ marginBottom: 20 }}>
            <Collapse
              items={[
                {
                  key: "no-runs",
                  label: "Tests stay 'queued' and never execute",
                  children: <Paragraph>
                    <ul>
                      <li>Verify the worker is running: check the <Text strong>Workers</Text> page or <Text code>docker compose logs worker</Text>.</li>
                      <li>Ensure the worker's <Text code>WORKER_CAPABILITIES</Text> includes the test's type (e.g. <Text code>http</Text> for HTTP tests).</li>
                      <li>Check PostgreSQL connectivity from the worker container.</li>
                    </ul>
                  </Paragraph>,
                },
                {
                  key: "401",
                  label: "API returns 401 Unauthorized",
                  children: <Paragraph>
                    <ul>
                      <li>Ensure Keycloak is healthy: <Text code>curl http://localhost:8080/realms/qtp</Text></li>
                      <li>Verify the token hasn't expired (default lifetime is 5 minutes).</li>
                      <li>Check that <Text code>KEYCLOAK_PUBLIC_URL</Text> matches the issuer in your token.</li>
                      <li>For CI, use <Text code>system-bearer-token</Text> instead.</li>
                    </ul>
                  </Paragraph>,
                },
                {
                  key: "ssrf",
                  label: "Request blocked by SSRF guard",
                  children: <Paragraph>
                    <ul>
                      <li>The target resolves to a private/loopback IP. This is expected for security.</li>
                      <li>For Docker-internal targets, add the hostname to <Text code>SSRF_ALLOWLIST</Text>.</li>
                      <li>Example: <Text code>SSRF_ALLOWLIST=httpbin,api,localhost</Text></li>
                    </ul>
                  </Paragraph>,
                },
                {
                  key: "discovery",
                  label: "Code tests not discovered",
                  children: <Paragraph>
                    <ul>
                      <li>Ensure the file is under <Text code>backend/tests/automations/</Text> and ends with <Text code>.py</Text>.</li>
                      <li>File names starting with <Text code>_</Text> are treated as helpers and skipped.</li>
                      <li>The class must subclass <Text code>BaseAutomationTest</Text> and have a <Text code>metadata</Text> attribute.</li>
                      <li>The <Text code>metadata.type</Text> must be in the <Text code>SUPPORTED_TYPES</Text> set.</li>
                      <li>Check the API response from <Text code>POST /api/tests/discover</Text> for errors.</li>
                    </ul>
                  </Paragraph>,
                },
                {
                  key: "worker-lost",
                  label: "Runs show 'error/worker_lost'",
                  children: <Paragraph>
                    <ul>
                      <li>The worker crashed or was stopped while processing a run.</li>
                      <li>The stale-worker reaper (runs every poll cycle) marks orphaned runs as lost.</li>
                      <li>Increase <Text code>WORKER_STALE_SECONDS</Text> if your tests legitimately take longer than 30s without heartbeating.</li>
                      <li>Check <Text code>docker compose logs worker</Text> for crash details.</li>
                    </ul>
                  </Paragraph>,
                },
                {
                  key: "db-connection",
                  label: "Database connection errors on startup",
                  children: <Paragraph>
                    <ul>
                      <li>The <Text code>init</Text> service must complete before API/worker/scheduler start. Docker Compose handles this via <Text code>depends_on</Text> with health checks.</li>
                      <li>Verify PostgreSQL is reachable: <Text code>docker compose exec postgres pg_isready -U qtp</Text></li>
                      <li>Check <Text code>DATABASE_URL</Text> is correct (user, password, host, port, database name).</li>
                    </ul>
                  </Paragraph>,
                },
              ]}
            />
          </Card>

          <Divider />
          <Paragraph type="secondary" style={{ textAlign: "center", marginBottom: 40 }}>
            QSINT Testing Platform — Developer Guide v1.0
          </Paragraph>

        </Typography>
      </Col>
    </Row>
  );
}
