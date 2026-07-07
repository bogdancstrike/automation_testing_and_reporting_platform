import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Col, Row, Tag, Typography } from "antd";
import {
  ApiOutlined,
  BugOutlined,
  BuildOutlined,
  CloudServerOutlined,
  CodeOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  FieldTimeOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  SafetyOutlined,
  ScheduleOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Callout } from "fumadocs-ui/components/callout";
import { Card as FumaCard, Cards } from "fumadocs-ui/components/card";
import "fumadocs-ui/style.css";

const { Paragraph, Text } = Typography;

const sections = [
  { id: "overview", title: "Overview" },
  { id: "mental-model", title: "Mental model" },
  { id: "quickstart", title: "Developer quickstart" },
  { id: "targets", title: "Targets and environments" },
  { id: "authoring", title: "Authoring scenarios" },
  { id: "scenario-types", title: "Scenario types" },
  { id: "assertions", title: "Assertions and captures" },
  { id: "request-builder", title: "Request Builder" },
  { id: "scheduling", title: "Scheduling" },
  { id: "execution", title: "Execution and results" },
  { id: "ci", title: "CI integration" },
  { id: "api", title: "API reference" },
  { id: "extend", title: "Extending QTP" },
  { id: "troubleshooting", title: "Troubleshooting" },
];

const navGroups = [
  { title: "Start", items: ["overview", "mental-model", "quickstart", "targets"] },
  { title: "Build", items: ["authoring", "scenario-types", "assertions", "request-builder"] },
  { title: "Operate", items: ["scheduling", "execution", "ci", "api"] },
  { title: "Advanced", items: ["extend", "troubleshooting"] },
];

const apiEndpoints = [
  ["GET", "/api/me", "Current developer identity and roles."],
  ["GET", "/api/targets", "List registered applications under test."],
  ["POST", "/api/targets", "Create a target for a service, environment, or app."],
  ["GET", "/api/tests", "List scenario definitions. The frontend route is /scenarios."],
  ["POST", "/api/tests/discover", "Discover code-backed scenarios from backend/scenarios/automation."],
  ["POST", "/api/tests/{id}/run", "Queue a scenario run immediately."],
  ["GET", "/api/runs", "Search execution history, filtered and sorted on the backend."],
  ["GET", "/api/runs/{id}", "Read steps, assertions, response, logs, and failure metadata."],
  ["POST", "/api/runs/{id}/cancel", "Request cancellation for a queued or running execution."],
  ["POST", "/api/schedules", "Create a schedule for one or more scenarios."],
  ["GET", "/api/schedules/{id}", "Read schedule configuration, scenarios, and recent runs."],
  ["GET", "/api/dashboards/overview", "Operational metrics over a time window."],
  ["GET", "/api/dashboards/failures", "Failure signatures, defect split, and recent failed runs."],
];

const scenarioTypes = [
  ["HttpTest", "HTTP API and service checks", "Use ctx.http and fluent response assertions."],
  ["PythonTest", "Custom Python logic", "Use any Python control flow and record explicit assertions."],
  ["CliTest", "Command-line tools", "Run shell commands, CLIs, or lightweight contract tools."],
  ["PlaywrightTest", "Browser checks", "Use Chromium for page-level workflows and UI smoke tests."],
  ["SeleniumTest", "Selenium-compatible suites", "Run WebDriver-oriented browser scenarios."],
];

function slugTitle(id: string) {
  return sections.find((s) => s.id === id)?.title || id;
}

function scrollToHash(hash: string) {
  const id = hash.replace("#", "");
  const element = document.getElementById(id);
  if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Code({ children }: { children: string }) {
  return <pre className="qtp-code qtp-docs-code">{children}</pre>;
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="qtp-docs-heading">
      <a href={`#${id}`} aria-label={`Link to ${id}`}>#</a>
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="qtp-docs-subheading">{children}</h3>;
}

function ApiTable() {
  return (
    <div className="qtp-docs-table">
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Use</th>
          </tr>
        </thead>
        <tbody>
          {apiEndpoints.map(([method, endpoint, use]) => (
            <tr key={`${method}-${endpoint}`}>
              <td><Tag>{method}</Tag></td>
              <td><code>{endpoint}</code></td>
              <td>{use}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocsPage() {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) window.setTimeout(() => scrollToHash(hash), 80);
  }, [hash]);

  return (
    <div className="qtp-docs-page">
      <Row gutter={24} align="top" wrap={false}>
        <Col xs={0} lg={5} className="qtp-docs-nav-col">
          <aside className="qtp-docs-side-nav" aria-label="Documentation navigation">
            <div className="qtp-docs-brand">QTP Developer Guide</div>
            {navGroups.map((group) => (
              <nav key={group.title}>
                <div className="qtp-docs-nav-title">{group.title}</div>
                {group.items.map((id) => (
                  <a key={id} href={`#${id}`}>{slugTitle(id)}</a>
                ))}
              </nav>
            ))}
          </aside>
        </Col>

        <Col xs={24} lg={14}>
          <article className="qtp-docs-article">
            <div className="qtp-docs-hero">
              <Tag color="blue">Developer documentation</Tag>
              <h1>Build reliable automation scenarios with QTP</h1>
              <p>
                QTP is a testing control plane for developers who need to define scenarios,
                run them on demand or on schedules, and understand failures without stitching
                together separate execution and reporting tools.
              </p>
            </div>

            <Cards className="qtp-docs-cards">
              <FumaCard icon={<RocketOutlined />} title="Author scenarios" description="Use Python classes, the Request Builder, or browser/CLI scenario types." />
              <FumaCard icon={<PlayCircleOutlined />} title="Run anywhere" description="Trigger scenarios manually, through schedules, or from CI." />
              <FumaCard icon={<BugOutlined />} title="Diagnose failures" description="Inspect steps, assertions, responses, logs, signatures, and defect types." />
              <FumaCard icon={<DeploymentUnitOutlined />} title="Integrate teams" description="Use targets, tags, roles, comments, and APIs to make test ownership explicit." />
            </Cards>

            <Callout title="Who this guide is for">
              This page is written for developers who use QTP to author and operate test scenarios.
              It intentionally avoids infrastructure administration details unless they affect how a
              developer writes or runs a scenario.
            </Callout>

            <H2 id="overview"><RocketOutlined /> Overview</H2>
            <Paragraph>
              QTP combines two jobs that are usually split across separate products. It acts as a
              scenario execution control plane, like Testkube, and as a central execution history and
              failure analysis system, like ReportPortal. Developers register targets, define
              scenarios, run them, schedule them, and review the exact evidence produced by each run.
            </Paragraph>
            <Paragraph>
              A scenario can be a small HTTP health check, a multi-step API workflow, a Python
              contract check, a CLI probe, or a browser scenario. All scenario types share the same
              platform concepts: metadata, target resolution, execution status, steps, assertions,
              logs, comments, and failure classification.
            </Paragraph>

            <H2 id="mental-model"><CloudServerOutlined /> Mental model</H2>
            <Paragraph>
              Think of QTP as a set of stable nouns. A <Text strong>target</Text> is the system under
              test. A <Text strong>scenario</Text> is the test definition. A <Text strong>revision</Text>
              is an immutable snapshot of a scenario. A <Text strong>run</Text> is one execution of one
              revision. A <Text strong>schedule</Text> creates runs automatically. A <Text strong>worker</Text>
              executes runs that match its capabilities.
            </Paragraph>
            <Code>{`Target
  key: qtp_self
  base_url: http://api:5100

Scenario
  key: self.health
  type: http_request
  target: qtp_self

Revision
  code_ref: scenarios.automation.qtp_self.health:SelfHealth

Run
  status: passed | failed | error | timeout | canceled
  evidence: steps + assertions + response + logs + metrics`}</Code>
            <Callout type="info" title="Scenario, not just test">
              The frontend uses the word scenario because QTP scenarios are often workflows, not only
              single assertions. The backend API still uses `/api/tests` for compatibility with the
              existing data model and clients.
            </Callout>

            <H2 id="quickstart"><ExperimentOutlined /> Developer quickstart</H2>
            <ol className="qtp-docs-steps">
              <li>
                <strong>Choose or create a target.</strong>
                A target is a service, UI, or environment you want to exercise. Use a stable key like
                <code>orders_api</code>, <code>qtp_self</code>, or <code>demo</code>.
              </li>
              <li>
                <strong>Author a scenario.</strong>
                Use a Python class under <code>backend/scenarios/automation</code> or save a request
                from the Request Builder.
              </li>
              <li>
                <strong>Discover code scenarios.</strong>
                Open <strong>Scenarios</strong> and click discovery. QTP imports classes by metadata key
                and creates new revisions only when code or config changes.
              </li>
              <li>
                <strong>Run it.</strong>
                Click run from the scenario catalog, run all scenarios for a target, or queue a run
                through the API from CI.
              </li>
              <li>
                <strong>Inspect evidence.</strong>
                The run page shows assertions, step timing, response body, logs, comments, failure
                signatures, and a shortcut back to the scenario definition.
              </li>
            </ol>
            <Code>{`# Discover code-backed scenarios
curl -X POST "$QTP_URL/api/tests/discover" \\
  -H "Authorization: Bearer $TOKEN"

# Run one scenario
curl -X POST "$QTP_URL/api/tests/$SCENARIO_ID/run" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"environment":"default"}'`}</Code>

            <H2 id="targets"><ApiOutlined /> Targets and environments</H2>
            <Paragraph>
              Targets decouple a scenario from the concrete URL it runs against. A scenario references
              <code>target="orders_api"</code>; QTP resolves the target at execution time and injects
              <code>{"{{base_url}}"}</code>. This keeps the scenario portable across local, staging, and
              production-like environments.
            </Paragraph>
            <ul>
              <li><strong>key:</strong> stable machine identifier used by scenarios and filters.</li>
              <li><strong>base_url:</strong> the root URL for requests and browser visits.</li>
              <li><strong>health_url:</strong> optional target health endpoint for dashboards.</li>
              <li><strong>default_headers:</strong> headers automatically applied to target-bound HTTP calls.</li>
              <li><strong>tags:</strong> ownership, domain, maturity, or environment labels.</li>
            </ul>
            <Callout type="warning" title="Keep target keys stable">
              Renaming a target key is a breaking change for code scenarios and saved request configs.
              Prefer changing the target URL or environment label while keeping the key stable.
            </Callout>

            <H2 id="authoring"><CodeOutlined /> Authoring scenarios</H2>
            <Paragraph>
              Code scenarios are Python classes with metadata and a <code>test(self, ctx)</code> method.
              They are discovered recursively from <code>backend/scenarios/automation</code>. The class
              name is not the identity; <code>metadata.key</code> is.
            </Paragraph>
            <Code>{`from src.testkit import TYPE_HTTP, HttpTest, TestMetadata

class OrdersHealth(HttpTest):
    metadata = TestMetadata(
        key="orders.health",
        name="Orders API health",
        type=TYPE_HTTP,
        tags=["orders", "smoke"],
        owner="payments-team",
        target="orders_api",
    )

    def test(self, ctx):
        response = ctx.http.get("/health")
        response.should.have_status(200)
        response.json.should.have_field("status").equal_to("ok")`}</Code>
            <H3>Lifecycle</H3>
            <Paragraph>
              For the scenario base classes, the framework executes <code>setup</code>, <code>test</code>,
              <code>cleanup</code>, and <code>teardown</code>. Use <code>cleanup</code> to undo data created in
              the application under test. Use <code>teardown</code> for local resources such as browser
              sessions or temporary files.
            </Paragraph>
            <H3>Context</H3>
            <ul>
              <li><code>ctx.http</code> sends target-bound HTTP requests.</li>
              <li><code>ctx.cli</code> runs commands for CLI scenarios.</li>
              <li><code>ctx.browser</code> opens Playwright-backed browser sessions.</li>
              <li><code>ctx.set_var</code> and <code>ctx.get_var</code> share data across steps.</li>
              <li><code>ctx.log</code> records structured messages on the run.</li>
            </ul>

            <H2 id="scenario-types"><BuildOutlined /> Scenario types</H2>
            <div className="qtp-docs-table">
              <table>
                <thead>
                  <tr>
                    <th>Base class</th>
                    <th>Best for</th>
                    <th>Developer API</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarioTypes.map(([name, best, api]) => (
                    <tr key={name}>
                      <td><code>{name}</code></td>
                      <td>{best}</td>
                      <td>{api}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout type="success" title="Pick the smallest useful scenario type">
              Use HTTP scenarios for API checks, Python scenarios for custom logic, CLI scenarios for
              command output, and browser scenarios only when the user interface itself is the contract.
            </Callout>

            <H2 id="assertions"><SafetyOutlined /> Assertions and captures</H2>
            <Paragraph>
              QTP treats assertions as first-class evidence. A run is useful only when it tells you
              what was checked, what was expected, what was observed, and where the failure happened.
              HTTP assertions support status codes, headers, body text, JSON paths, response time, and
              lightweight schema checks.
            </Paragraph>
            <Code>{`response.should.have_status(201)
response.should.respond_within_ms(1000)
response.should.have_header("Content-Type").containing("json")
response.json.should.have_field("id").exists()
response.json.should.have_field("status").equal_to("created")
response.json.should.have_field("items").with_length_at_least(1)`}</Code>
            <Paragraph>
              Captures let one step feed another. In Request Builder flows, a capture extracts a value
              from JSON, headers, or body text and stores it as a variable. In Python scenarios, use
              <code>ctx.set_var("token", token)</code> and reference it later as <code>{"{{token}}"}</code>.
            </Paragraph>

            <H2 id="request-builder"><ToolOutlined /> Request Builder</H2>
            <Paragraph>
              The Request Builder is for developers who want to create and debug HTTP scenarios without
              writing a Python file. It supports single requests and multi-step flows with captures.
              Saved requests become normal managed scenarios: they appear in Scenarios, can be run,
              scheduled, tagged, commented on, and inspected like code scenarios.
            </Paragraph>
            <Code>{`{
  "name": "Login and read profile",
  "config": {
    "target": "users_api",
    "steps": [
      {
        "id": "login",
        "method": "POST",
        "url": "/login",
        "body": {"mode": "json", "raw": "{\\"user\\":\\"alice\\"}"},
        "captures": [{"name": "token", "source": "json_path", "path": "$.token"}],
        "assertions": [{"type": "status_code", "operator": "equals", "expected": 200}]
      },
      {
        "id": "profile",
        "method": "GET",
        "url": "/me",
        "headers": [{"name": "Authorization", "value": "Bearer {{token}}"}],
        "assertions": [{"type": "json_path", "path": "$.username", "operator": "equals", "expected": "alice"}]
      }
    ]
  }
}`}</Code>

            <H2 id="scheduling"><ScheduleOutlined /> Scheduling</H2>
            <Paragraph>
              Schedules automate scenario runs. A schedule can run one scenario or a group of scenarios
              at the same recurrence. This is useful for smoke packs, integration packs, and long-running
              confidence checks that should execute together every few minutes.
            </Paragraph>
            <ul>
              <li><code>interval</code>: run every N seconds.</li>
              <li><code>cron</code>: run at a cron expression in a timezone.</li>
              <li><code>once</code>: run at a specific time, then disable.</li>
            </ul>
            <Paragraph>
              Schedule detail shows the recurrence, target mix, all included scenarios, recent runs, and
              status distribution. When the scheduler fires, it queues one run for each scenario in the
              schedule, all linked by the same schedule ID.
            </Paragraph>

            <H2 id="execution"><FieldTimeOutlined /> Execution and results</H2>
            <Paragraph>
              Runs are durable records. They start as queued work, are picked up by a capability-aware
              worker, then finish with a terminal status. The run detail page is the primary debugging
              surface: it includes scenario link, assertions, response, execution flow, steps, logs, and
              comments.
            </Paragraph>
            <ul>
              <li><Tag color="green">passed</Tag> All required assertions passed.</li>
              <li><Tag color="red">failed</Tag> Scenario ran but at least one assertion failed.</li>
              <li><Tag color="orange">error</Tag> Scenario or platform execution failed unexpectedly.</li>
              <li><Tag color="gold">timeout</Tag> A request, command, or scenario exceeded its budget.</li>
              <li><Tag>canceled</Tag> A queued/running scenario was canceled.</li>
            </ul>
            <Paragraph>
              Failed runs can be triaged with defect types such as <code>product_bug</code>,
              <code>automation_bug</code>, <code>system_issue</code>, <code>to_investigate</code>, and
              <code>no_defect</code>. Failure signatures group repeated failures so teams can see whether
              an issue is new or recurring.
            </Paragraph>

            <H2 id="ci"><DeploymentUnitOutlined /> CI integration</H2>
            <Paragraph>
              Use QTP from CI when you want the pipeline to trigger a scenario or pack but keep evidence
              in the platform. CI should call the API, wait for completion when appropriate, and link to
              the run detail URL in pipeline logs.
            </Paragraph>
            <Code>{`#!/usr/bin/env bash
set -euo pipefail

RUN=$(curl -sf -X POST "$QTP_URL/api/tests/$SCENARIO_ID/run" \\
  -H "Authorization: Bearer $QTP_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"environment":"ci"}')

RUN_ID=$(echo "$RUN" | jq -r '.id')
echo "QTP run: $QTP_WEB_URL/runs/$RUN_ID"`}</Code>
            <Callout type="warning" title="CI should not duplicate QTP's reporting">
              Let QTP own run evidence. CI only needs to trigger the run, enforce the release gate, and
              publish a link back to the platform.
            </Callout>

            <H2 id="api"><ApiOutlined /> API reference</H2>
            <Paragraph>
              Most developer workflows can be automated through the API. The frontend route names use
              <code>/scenarios</code>, while the backend API path remains <code>/api/tests</code>.
            </Paragraph>
            <ApiTable />

            <H2 id="extend"><CodeOutlined /> Extending QTP</H2>
            <Paragraph>
              Add a new scenario type only when an existing type cannot express the test clearly. A new
              adapter should convert domain-specific output into QTP's common result model: steps,
              assertions, status, response, logs, and metrics.
            </Paragraph>
            <Code>{`# Adapter checklist
1. Add a scenario type constant in src/testkit/base.py.
2. Implement execute_<adapter>(config, ctx) -> TestResult.
3. Dispatch it from src/execution/runner.py.
4. Add a worker capability for the adapter.
5. Add scenario examples under backend/scenarios/automation.
6. Document what evidence the adapter records.`}</Code>

            <H2 id="troubleshooting"><BugOutlined /> Troubleshooting</H2>
            <H3>Scenario does not appear after discovery</H3>
            <ul>
              <li>Confirm the file is under <code>backend/scenarios/automation</code>.</li>
              <li>Confirm the class subclasses one of QTP's scenario base classes.</li>
              <li>Confirm <code>metadata.key</code> is globally unique.</li>
              <li>Run discovery and check the API response for validation errors.</li>
            </ul>
            <H3>Run remains queued</H3>
            <ul>
              <li>Check that at least one worker advertises the required capability.</li>
              <li>Open Workers and confirm heartbeats are fresh.</li>
              <li>For browser tests, confirm the worker image includes Playwright/Selenium support.</li>
            </ul>
            <H3>Request is blocked</H3>
            <ul>
              <li>QTP applies SSRF protections to outbound HTTP calls.</li>
              <li>Use registered targets and avoid private/internal addresses unless explicitly allowed.</li>
              <li>If a dev-only internal target is intentional, add it to the allowlist in platform config.</li>
            </ul>
          </article>
        </Col>

        <Col xs={0} lg={5} className="qtp-docs-toc-col">
          <aside className="qtp-docs-toc" aria-label="On this page">
            <div className="qtp-docs-toc-title">On this page</div>
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>{section.title}</a>
            ))}
          </aside>
        </Col>
      </Row>
    </div>
  );
}
