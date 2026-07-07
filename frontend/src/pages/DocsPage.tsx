import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Anchor, Card, Col, Row, Typography, Table, Tag, Alert } from "antd";

const { Title, Paragraph, Text } = Typography;

function Code({ children }: { children: string }) {
  return <pre className="qtp-code">{children}</pre>;
}

const PY_TEST = `# tests/automations/api/test_create_order.py
from src.testkit.adapters.http import execute_http
from src.testkit.base import TYPE_HTTP, BaseAutomationTest, TestMetadata
from src.testkit.context import TestContext
from src.testkit.result import TestResult


class CreateOrderTest(BaseAutomationTest):
    # Stable identity + defaults. 'target' names the app-under-test; its
    # base_url is resolved at run time so this test runs against any env.
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
        # optional: seed prerequisites, resolve secrets, etc.
        self._created_id = None

    def execute(self, ctx: TestContext) -> TestResult:
        result = execute_http(dict(self.metadata.default_config), ctx)
        # capture the created id so cleanup can remove it
        body = result.response.get("body_text", "")
        self._created_id = ctx  # ... parse id from body as needed
        return result

    def cleanup(self, ctx: TestContext) -> None:
        # Runs on success AND failure, before teardown. Undo what execute created
        # so runs don't leak state. GET-only tests can skip this entirely.
        if getattr(self, "_created_id", None):
            execute_http({
                "method": "DELETE",
                "url": "{{base_url}}/api/orders/" + str(self._created_id),
                "assertions": [{"type": "status_code", "operator": "in", "expected": [200, 204]}],
            }, ctx)`;

const DISCOVER = `# 1. Tell QTP which modules hold tests (backend/.env or compose env)
AUTOMATION_MODULES=tests.automations.api.test_create_order,tests.automations.api.test_healthcheck

# 2. Trigger discovery from the UI (Test Catalog -> "Discover code tests")
#    or via the API:
curl -X POST http://localhost:5100/qtp/api/tests/discover \\
     -H "Authorization: Bearer $TOKEN"`;

const RUN_NOW = `# On demand (also the "Run now" button in the catalog / test detail):
curl -X POST http://localhost:5100/qtp/api/tests/<test_id>/run \\
     -H "Authorization: Bearer $TOKEN" \\
     -H "Content-Type: application/json" \\
     -d '{"environment": "default"}'`;

const SCHED = `# Every 5 minutes:
curl -X POST http://localhost:5100/qtp/api/schedules \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"test_definition_id":"<id>","recurrence_type":"interval","interval_seconds":300}'

# Cron (weekdays 09:00 UTC):
  -d '{"test_definition_id":"<id>","recurrence_type":"cron","cron_expression":"0 9 * * 1-5","timezone":"UTC"}'`;

const SAVE_UI = `POST /qtp/api/request-tests
{
  "name": "Orders API creates order",
  "config": {
    "target": "orders_api",
    "method": "POST",
    "url": "{{base_url}}/api/orders",
    "body": {"mode": "json", "raw": "{\\"item\\":\\"widget\\"}"},
    "assertions": [
      {"type": "status_code", "operator": "equals", "expected": 201},
      {"type": "json_path", "path": "$.id", "operator": "exists"}
    ]
  }
}`;

const SAVE_UI_FLOW = `POST /qtp/api/request-tests
{
  "name": "Multi-step Flow Test",
  "config": {
    "steps": [
      {
        "id": "get_token",
        "name": "Get Token",
        "method": "POST",
        "url": "{{base_url}}/api/auth",
        "body": {"mode": "json", "raw": "{\\"user\\":\\"admin\\"}"},
        "assertions": [{"type": "status_code", "operator": "equals", "expected": 200}],
        "captures": [{"name": "auth_token", "source": "json_path", "path": "$.token"}]
      },
      {
        "id": "create_item",
        "name": "Create Item",
        "method": "POST",
        "url": "{{base_url}}/api/items",
        "auth": {"type": "bearer", "tokenSecretRef": "auth_token"},
        "body": {"mode": "json", "raw": "{\\"name\\":\\"widget\\"}"},
        "assertions": [{"type": "status_code", "operator": "equals", "expected": 201}]
      }
    ]
  }
}`;

const TOKEN = `# Obtain a bearer token from Keycloak (direct grant, dev only):
curl -s http://localhost:8080/realms/qtp/protocol/openid-connect/token \\
  -d grant_type=password -d client_id=qtp-spa \\
  -d username=admin -d password=admin | jq -r .access_token

# Or use the system bearer token for CI pipelines:
# This token bypasses standard IAM checks and automatically resolves to the admin user.
export TOKEN="system-bearer-token"`;

const ADAPTER = `# 1. Add an adapter base or function under src/testkit/adapters/
# 2. Register its capability in src/testkit/registry (+ worker WORKER_CAPABILITIES)
# 3. Map its output to TestResult (status, steps, assertions)
# 4. Dispatch it in src/execution/runner.execute_run by metadata.type
# 5. (optional) add a UI editor if it is user-configurable`;

const SOURCES = [
  ["status_code", "The numeric HTTP status", "equals 200"],
  ["json_path", "A value extracted by JSONPath ($.a.b[0])", "$.status equals created"],
  ["header", "A named response header", "Content-Type contains json"],
  ["body_text", "The raw response body as text", "contains OK"],
  ["response_time_ms", "Total response duration", "lte 800"],
];
const OPERATORS = [
  "equals / not_equals", "contains / not_contains", "matches / not_matches (regex)",
  "exists / not_exists", "gt / gte / lt / lte", "length_eq / length_gte / length_lte",
  "in / not_in",
];

const ENDPOINTS = [
  ["GET", "/api/tests", "List/filter test definitions"],
  ["POST", "/api/tests/discover", "Import code-based tests"],
  ["POST", "/api/tests/{id}/run", "Run a test on demand"],
  ["POST", "/api/request-tests/send", "Send an unsaved request"],
  ["POST", "/api/request-tests", "Save a request as a test"],
  ["GET", "/api/runs", "Search runs"],
  ["GET", "/api/runs/{id}", "Run detail (steps, assertions, response)"],
  ["PUT", "/api/runs/{id}/defect", "Set the defect type"],
  ["GET/POST", "/api/schedules", "List / create schedules"],
  ["GET", "/api/dashboards/overview", "KPIs, trend, per-target"],
  ["GET", "/api/dashboards/failures", "Signatures + defect distribution"],
];

export default function DocsPage() {
  const { hash } = useLocation();

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

  return (
    <Row gutter={24}>
      <Col xs={0} lg={5}>
        <Anchor
          style={{ position: "sticky", top: 20 }}
          onClick={(e, link) => {
            e.preventDefault();
            const id = link.href.replace('#', '');
            const element = document.getElementById(id);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth' });
              window.history.pushState(null, '', link.href);
            }
          }}
          items={[
            { key: "concepts", href: "#concepts", title: "Concepts" },
            { key: "two-ways", href: "#two-ways", title: "Two ways to add a test" },
            { key: "python", href: "#python", title: "Author a Python test" },
            { key: "register", href: "#register", title: "Register (discovery)" },
            { key: "ui", href: "#ui", title: "Create a request test (UI)" },
            { key: "env-vars", href: "#env-vars", title: "Variables & Secrets" },
            { key: "run", href: "#run", title: "Run on demand" },
            { key: "schedule", href: "#schedule", title: "Schedule recurrence" },
            { key: "workers", href: "#workers", title: "Worker Architecture" },
            { key: "assertions", href: "#assertions", title: "Assertion catalogue" },
            { key: "extend", href: "#extend", title: "Extend the platform" },
            { key: "api", href: "#api", title: "API reference" },
          ]}
        />
      </Col>
      <Col xs={24} lg={19}>
        <Typography style={{ maxWidth: 900 }}>
          <Title level={2}>Developer Guide</Title>
          <Paragraph type="secondary">
            How to add automated tests to QTP — as Python code via the framework, or from the UI — and run them
            on demand or on a schedule against any target application. This guide also covers advanced concepts like data captures and the worker fleet architecture.
          </Paragraph>

          <Card id="concepts" title="Concepts" style={{ marginBottom: 20 }}>
            <Paragraph>
              <ul>
                <li><Text strong>Target</Text> — an app-under-test addressed by URL. Tests reference a target key; its
                  <Text code>base_url</Text> is resolved at run time, so the same test runs against dev/staging/prod.</li>
                <li><Text strong>Test Definition</Text> — the stable identity of a test (key, name, type). <Text strong>Revision</Text> — an immutable version of its code reference or request config.</li>
                <li><Text strong>Run</Text> — one execution, producing <Text strong>steps</Text>, <Text strong>assertions</Text>, logs, and a final status (passed/failed/error/timeout/canceled).</li>
                <li><Text strong>Failure signature</Text> groups equivalent failures; <Text strong>defect type</Text> (product/automation/system/…) is the triage on top, auto-suggested from prior triage.</li>
              </ul>
            </Paragraph>
          </Card>

          <Card id="two-ways" title="Two ways to add a test" style={{ marginBottom: 20 }}>
            <Paragraph>
              <ol>
                <li><Text strong>Python code</Text> via the framework — full power (setup/cleanup/teardown, custom logic), lives in the repo under <Text code>tests/automations/</Text>, imported by discovery.</li>
                <li><Text strong>UI request builder</Text> — a Postman-like editor for HTTP tests with assertions on the response body, headers, and timing. No code, saved as a managed test.</li>
              </ol>
              Both address a target by URL and both can be run on demand or scheduled.
            </Paragraph>
          </Card>

          <Card id="python" title="Author a code-based test in Python" style={{ marginBottom: 20 }}>
            <Paragraph>
              Subclass <Text code>BaseAutomationTest</Text>, declare <Text code>TestMetadata</Text>, and implement the
              hooks you need. The framework calls them in order:
              <Text code>validate_config → setup → execute → cleanup → teardown</Text>. Only <Text code>execute</Text> is
              required; <Text code>cleanup</Text> and <Text code>teardown</Text> always run (even on failure).
            </Paragraph>
            <Code>{PY_TEST}</Code>
            <Alert type="info" showIcon style={{ marginTop: 12 }}
              message="cleanup() vs teardown()"
              description="cleanup() reverts data the test created on the app-under-test (so mutating tests don't leak state). teardown() releases resources the test held (sessions, browsers, drivers). A read-only GET test implements neither." />
          </Card>

          <Card id="register" title="Register it (discovery)" style={{ marginBottom: 20 }}>
            <Paragraph>
              QTP automatically discovers code-based tests by recursively scanning the <Text code>backend/tests/automations/</Text> directory. You do not need to manually register your test files.
              Discovery imports the modules and upserts a definition per unique <Text code>metadata.key</Text>,
              creating a new immutable revision only when the code reference or default config changed. Tests that vanish
              from source are marked <Text code>missing_from_source</Text>, never deleted.
            </Paragraph>
            <Code>{DISCOVER}</Code>
          </Card>

          <Card id="ui" title="Create a request test from the UI" style={{ marginBottom: 20 }}>
            <Paragraph>
              Open <Text strong>Request Builder</Text>, pick a target (or type an absolute URL), set method/headers/body,
              add assertions on the response, click <Text strong>Send</Text> to try it, then <Text strong>Save</Text> to
              persist it as a managed test. You can also toggle <Text strong>Multi-step Flow</Text> to string together multiple requests sequentially, passing variables between steps using captures.
            </Paragraph>
            <Paragraph>
              Equivalent single request API call:
            </Paragraph>
            <Code>{SAVE_UI}</Code>
            <Paragraph>
              Equivalent multi-step flow request API call:
            </Paragraph>
            <Code>{SAVE_UI_FLOW}</Code>
          </Card>

          <Card id="env-vars" title="Variables & Secrets" style={{ marginBottom: 20 }}>
            <Paragraph>
              QTP supports string interpolation across your request URLs, headers, and bodies. The syntax uses double curly braces: <Text code>{"{{variable_name}}"}</Text>.
            </Paragraph>
            <Paragraph>
              Built-in variables:
              <ul>
                <li><Text code>{"{{base_url}}"}</Text> - Resolves to the <Text strong>target's</Text> base URL mapped to the current run. This allows the test to be fully portable across dev, staging, and production environments.</li>
              </ul>
            </Paragraph>
            <Paragraph>
              Captures:
              In Multi-Step flows, you can extract tokens, IDs, or any value from one step and use them in subsequent steps. When defining a capture (e.g. `auth_token`), it is injected into the execution context and can be referenced later via <Text code>{"{{auth_token}}"}</Text> or mapped directly in the Auth tab.
            </Paragraph>
          </Card>

          <Card id="run" title="Run on demand" style={{ marginBottom: 20 }}>
            <Paragraph>Use “Run now” in the catalog/detail, or via API:</Paragraph>
            <Code>{RUN_NOW}</Code>
          </Card>

          <Card id="schedule" title="Schedule recurrence" style={{ marginBottom: 20 }}>
            <Paragraph>
              Schedules run <Text strong>independently</Text> of on-demand runs. Supported: <Text code>once</Text>,
              <Text code>interval</Text>, and <Text code>cron</Text> (with timezone). The scheduler process enqueues due
              runs; the worker executes them.
            </Paragraph>
            <Code>{SCHED}</Code>
          </Card>

          <Card id="workers" title="Worker Architecture" style={{ marginBottom: 20 }}>
            <Paragraph>
              QTP's execution model is decoupled. The API server enqueues runs into PostgreSQL, acting as the <Text strong>Run Queue</Text>.
            </Paragraph>
            <Paragraph>
              <Text strong>Worker Nodes</Text> run asynchronously, constantly polling the queue for claimed tasks. They pull a <Text code>TestDefinition</Text>, initialize the <Text code>TestContext</Text>, execute the python adapter (or arbitrary test framework), capture steps, run assertions, and push the <Text code>TestResult</Text> and logs back into the database.
            </Paragraph>
            <Paragraph>
              Workers advertise their <Text code>capabilities</Text> to ensure they only pick up jobs they can process. The system uses a heartbeat mechanism so you can view all active agents globally on the <Text strong>Workers</Text> dashboard.
            </Paragraph>
          </Card>

          <Card id="assertions" title="Assertion catalogue" style={{ marginBottom: 20 }}>
            <Paragraph>Assertions check the <Text strong>output</Text>, not just the status code.</Paragraph>
            <Table size="small" pagination={false} rowKey={(r: any) => r[0]}
              dataSource={SOURCES} style={{ marginBottom: 12 }}
              columns={[
                { title: "Source", render: (_, r) => <Text code>{r[0]}</Text> },
                { title: "Meaning", render: (_, r) => r[1] },
                { title: "Example", render: (_, r) => <Text code>{r[2]}</Text> },
              ]} />
            <Paragraph><Text strong>Operators:</Text> {OPERATORS.map((o) => <Tag key={o}>{o}</Tag>)}</Paragraph>
          </Card>

          <Card id="extend" title="Extend the platform" style={{ marginBottom: 20 }}>
            <Paragraph>Add a new adapter/executor (e.g. gRPC, a CLI tool, a browser flow):</Paragraph>
            <Code>{ADAPTER}</Code>
          </Card>

          <Card id="api" title="API reference" style={{ marginBottom: 20 }}>
            <Paragraph>All endpoints live under <Text code>/qtp</Text> and require a bearer token.</Paragraph>
            <Code>{TOKEN}</Code>
            <Table size="small" pagination={false} rowKey={(r: any) => r[0] + r[1]} style={{ marginTop: 12 }}
              dataSource={ENDPOINTS}
              columns={[
                { title: "Method", width: 90, render: (_, r) => <Tag>{r[0]}</Tag> },
                { title: "Path", render: (_, r) => <Text code>{r[1]}</Text> },
                { title: "Purpose", render: (_, r) => r[2] },
              ]} />
          </Card>
        </Typography>
      </Col>
    </Row>
  );
}
