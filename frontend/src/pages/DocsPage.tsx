import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Col, Row, Tag, Typography, theme } from "antd";
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
  ReadOutlined,
  AppstoreAddOutlined,
  GlobalOutlined,
  DashboardOutlined,
  DesktopOutlined,
} from "@ant-design/icons";
import { Callout } from "fumadocs-ui/components/callout";
import { Card as FumaCard, Cards } from "fumadocs-ui/components/card";
import "fumadocs-ui/style.css";

const { Paragraph, Text } = Typography;

const sections = [
  { id: "overview", title: "Overview" },
  { id: "scope-use-cases", title: "Scope & Use Cases" },
  { id: "architecture", title: "Architecture & Integration" },
  { id: "mental-model", title: "Mental Model" },
  { id: "quickstart", title: "Developer Quickstart" },
  { id: "targets", title: "Targets & Environments" },
  { id: "authoring-http", title: "Authoring: HTTP APIs" },
  { id: "authoring-python", title: "Authoring: Python Logic" },
  { id: "authoring-browser", title: "Authoring: Browser Tests" },
  { id: "authoring-cli", title: "Authoring: CLI Tools" },
  { id: "assertions", title: "Assertions & Captures" },
  { id: "request-builder", title: "Request Builder" },
  { id: "scheduling", title: "Scheduling" },
  { id: "execution", title: "Execution & Results" },
  { id: "ci", title: "CI Integration" },
  { id: "api", title: "API Reference" },
  { id: "extend", title: "Extending QTP" },
  { id: "troubleshooting", title: "Troubleshooting" },
];

const navGroups = [
  { title: "Introduction", items: ["overview", "scope-use-cases", "architecture", "mental-model"] },
  { title: "Getting Started", items: ["quickstart", "targets"] },
  { title: "Authoring Scenarios", items: ["authoring-http", "authoring-python", "authoring-browser", "authoring-cli", "assertions", "request-builder"] },
  { title: "Operations", items: ["scheduling", "execution", "ci", "api"] },
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
  ["HttpTest", "HTTP API and service checks", "Use ctx.http and fluent response assertions. Best for REST/GraphQL endpoints."],
  ["PythonTest", "Custom Python logic", "Use any Python control flow, external libraries (e.g., DB drivers) and record explicit assertions."],
  ["CliTest", "Command-line tools", "Run shell commands, CLIs, or lightweight contract tools locally within the worker."],
  ["PlaywrightTest", "Browser checks", "Use Chromium for page-level workflows and UI smoke tests. Supports modern SPA checks."],
  ["SeleniumTest", "Selenium-compatible suites", "Run WebDriver-oriented browser scenarios (legacy support or specific grid needs)."],
];

function slugTitle(id: string) {
  return sections.find((s) => s.id === id)?.title || id;
}

function scrollToHash(hash: string) {
  const id = hash.replace("#", "");
  const element = document.getElementById(id);
  if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Code({ children, language = "plaintext" }: { children: string; language?: string }) {
  return <pre className={`qtp-code qtp-docs-code language-${language}`}>{children}</pre>;
}

function H2({ id, icon, children }: { id: string; icon?: React.ReactNode; children: React.ReactNode }) {
  const { token } = theme.useToken();
  return (
    <h2 id={id} className="qtp-docs-heading" style={{ marginTop: '3em', paddingBottom: '0.5em', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
      <a href={`#${id}`} aria-label={`Link to ${id}`} style={{ marginRight: '8px', color: token.colorTextQuaternary, textDecoration: 'none' }}>#</a>
      {icon && <span style={{ marginRight: '12px' }}>{icon}</span>}
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="qtp-docs-subheading" style={{ marginTop: '2em' }}>{children}</h3>;
}

function ApiTable() {
  const { token } = theme.useToken();
  return (
    <div className="qtp-docs-table" style={{ overflowX: 'auto', marginTop: '1em' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${token.colorBorderSecondary}` }}>
            <th style={{ padding: '12px 8px' }}>Method</th>
            <th style={{ padding: '12px 8px' }}>Endpoint</th>
            <th style={{ padding: '12px 8px' }}>Use</th>
          </tr>
        </thead>
        <tbody>
          {apiEndpoints.map(([method, endpoint, use]) => (
            <tr key={`${method}-${endpoint}`} style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
              <td style={{ padding: '12px 8px' }}><Tag color={method === 'GET' ? 'blue' : method === 'POST' ? 'green' : 'default'}>{method}</Tag></td>
              <td style={{ padding: '12px 8px' }}><code>{endpoint}</code></td>
              <td style={{ padding: '12px 8px' }}>{use}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocsPage() {
  const { hash } = useLocation();
  const { token } = theme.useToken();

  useEffect(() => {
    if (hash) window.setTimeout(() => scrollToHash(hash), 80);
  }, [hash]);

  return (
    <div className="qtp-docs-page" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <Row gutter={48} align="top" wrap={false}>
        <Col xs={0} lg={5} className="qtp-docs-nav-col" style={{ position: 'sticky', top: '24px', height: 'calc(100vh - 48px)', overflowY: 'auto' }}>
          <aside className="qtp-docs-side-nav" aria-label="Documentation navigation">
            <div className="qtp-docs-brand" style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '24px', color: token.colorText }}>QTP Developer Guide</div>
            {navGroups.map((group) => (
              <nav key={group.title} style={{ marginBottom: '24px' }}>
                <div className="qtp-docs-nav-title" style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: token.colorTextSecondary, fontWeight: 600, marginBottom: '8px' }}>{group.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {group.items.map((id) => (
                    <a key={id} href={`#${id}`} style={{ color: token.colorText, textDecoration: 'none', fontSize: '0.95rem' }}>{slugTitle(id)}</a>
                  ))}
                </div>
              </nav>
            ))}
          </aside>
        </Col>

        <Col xs={24} lg={19}>
          <article className="qtp-docs-article" style={{ fontSize: '1.05rem', lineHeight: 1.7, color: token.colorText }}>
            <div className="qtp-docs-hero" style={{ marginBottom: '3rem' }}>
              <Tag color="blue" style={{ marginBottom: '16px' }}>Developer documentation</Tag>
              <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '16px', lineHeight: 1.2, color: token.colorTextHeading }}>
                Build reliable automation scenarios with QTP
              </h1>
              <p style={{ fontSize: '1.25rem', color: token.colorTextSecondary }}>
                QTP (Quality Test Platform) is a testing control plane built for developers. It enables you to define, 
                orchestrate, and debug test scenarios—from simple HTTP checks to complex UI workflows—across environments, 
                all within a single unified platform.
              </p>
            </div>

            <Cards className="qtp-docs-cards" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '3rem' }}>
              <FumaCard icon={<CodeOutlined />} title="Author Anywhere" description="Write scenarios in Python, use the UI Request Builder, or bring Playwright/CLI tests." />
              <FumaCard icon={<CloudServerOutlined />} title="Environment Agnostic" description="Run the same scenario against local, staging, or production seamlessly." />
              <FumaCard icon={<BugOutlined />} title="Deep Diagnostics" description="Inspect step-by-step executions, exact assertions, full response bodies, and logs." />
              <FumaCard icon={<DeploymentUnitOutlined />} title="CI/CD Ready" description="Trigger scenarios from pipelines with first-class API support." />
            </Cards>

            <Callout title="Who this guide is for" type="info">
              This guide is written specifically for <strong>Developers</strong> and <strong>SDETs</strong> who use QTP to write, schedule, and maintain test scenarios. 
              It covers how to interact with the system, author code-backed tests, and integrate with CI. It intentionally avoids infrastructure setup and administration details (like deploying QTP itself).
            </Callout>

            <H2 id="overview" icon={<ReadOutlined />}>Overview</H2>
            <Paragraph>
              As software systems grow, verifying behavior becomes scattered. API tests run in Postman, UI tests in a CI job with GitHub Actions, and integration tests as a bash script. When a pipeline fails, developers have to hunt down logs across different systems to figure out what broke.
            </Paragraph>
            <Paragraph>
              <strong>QTP solves this by providing a centralized testing control plane.</strong> It acts as the single source of truth for both scenario execution and reporting. You can write your scenarios as standard Python code in a repository, and QTP will automatically discover them, run them on targeted environments, and provide a rich UI to inspect exactly what happened during the execution.
            </Paragraph>

            <H2 id="scope-use-cases" icon={<AppstoreAddOutlined />}>Scope & Use Cases</H2>
            <Paragraph>
              QTP is highly versatile, supporting a wide range of validation strategies:
            </Paragraph>
            <ul>
              <li><strong>Continuous Delivery Gates:</strong> Trigger regression suites automatically from Jenkins, GitLab CI, or GitHub Actions after a deployment.</li>
              <li><strong>Production Smoke & Sanity:</strong> Schedule lightweight HTTP checks to run every 5 minutes against production APIs to ensure core flows (like login or checkout) are operational.</li>
              <li><strong>End-to-End Workflows:</strong> Write complex, stateful scenarios that span multiple services (e.g., creating a user via API, modifying data via DB queries, and verifying it in the UI with Playwright).</li>
              <li><strong>Environment Promotion:</strong> Run the exact same test suite against <code>staging</code> and <code>production</code> by simply swapping the Target definition.</li>
            </ul>

            <H2 id="architecture" icon={<DeploymentUnitOutlined />}>Architecture & Integration</H2>
            <Paragraph>
              Understanding QTP's architecture helps you write better scenarios. The platform consists of a few main components:
            </Paragraph>
            <ul>
              <li><strong>The Control Plane (Backend & UI):</strong> Manages test definitions, schedules, and execution history. It exposes a REST API that the UI and your CI/CD pipelines talk to.</li>
              <li><strong>Workers (Execution Agents):</strong> The actual runners that execute your scenarios. Workers poll the backend for jobs via Kafka. They are scalable and isolated, with specialized images supporting Python, HTTP, CLI, Playwright, and Selenium execution capabilities.</li>
              <li><strong>Your Code Repository:</strong> Code-backed scenarios live in your repository (typically under <code>backend/scenarios/automation</code>). QTP discovers these via API triggers.</li>
            </ul>
            <Paragraph>
              <strong>The Integration Flow:</strong> You push a new Python scenario to your Git repo. A CI step calls QTP's <code>/discover</code> endpoint. QTP parses the new metadata. Later, a schedule or CI job calls <code>/run</code>. The backend queues a job. A Worker picks it up, pulls the latest code, executes the steps, and streams the assertions and logs back to the Control Plane in real-time.
            </Paragraph>

            <H2 id="mental-model" icon={<CloudServerOutlined />}>Core Concepts & Mental Model</H2>
            <Paragraph>
              To effectively use QTP, you need to understand its five core entities:
            </Paragraph>
            <ul>
              <li><Text strong>Target:</Text> The system you are testing. It defines a <code>base_url</code> (e.g., <code>https://api.staging.example.com</code>). Targets abstract away environment details from your code.</li>
              <li><Text strong>Scenario (Test):</Text> The logical definition of what you are verifying. It has a unique <code>key</code> (e.g., <code>checkout.success</code>), tags, and belongs to a Target.</li>
              <li><Text strong>Revision:</Text> An immutable snapshot of a scenario's configuration at a specific point in time. When you change code and run discovery, a new revision is created.</li>
              <li><Text strong>Run:</Text> A single execution attempt of a specific Revision. It produces evidence (steps, assertions, logs) and ends in a terminal state (<code>passed</code>, <code>failed</code>, <code>error</code>).</li>
              <li><Text strong>Schedule:</Text> A rule to automatically trigger Runs (e.g., "Run all scenarios tagged 'smoke' against Target 'production_api' every 10 minutes").</li>
            </ul>
            <Code language="yaml">{`# A conceptual representation of how entities relate
Target (staging_api)
  └── Scenario (login_flow)
       ├── Revision (v1)
       │    └── Run (ID: 104, Status: passed)
       └── Revision (v2)
            ├── Run (ID: 105, Status: failed)
            └── Run (ID: 106, Status: passed)`}</Code>

            <H2 id="quickstart" icon={<ExperimentOutlined />}>Developer Quickstart</H2>
            <Paragraph>
              Follow these steps to get your first scenario running:
            </Paragraph>
            <ol className="qtp-docs-steps" style={{ paddingLeft: '20px', margin: '20px 0' }}>
              <li style={{ marginBottom: '16px' }}>
                <strong>Create a Target.</strong>
                Navigate to <strong>Targets</strong> in the UI. Create one named <code>demo_api</code> with URL <code>https://jsonplaceholder.typicode.com</code>.
              </li>
              <li style={{ marginBottom: '16px' }}>
                <strong>Write the Scenario Code.</strong>
                In your project repo, create a file at <code>backend/scenarios/automation/demo_test.py</code>:
                <Code language="python">{`from src.testkit import TYPE_HTTP, HttpTest, TestMetadata

class DemoApiTest(HttpTest):
    metadata = TestMetadata(
        key="demo.fetch_user",
        name="Fetch User Data",
        type=TYPE_HTTP,
        target="demo_api",
        tags=["demo"]
    )

    def test(self, ctx):
        resp = ctx.http.get("/users/1")
        resp.should.have_status(200)
        resp.json.should.have_field("email").exists()`}</Code>
              </li>
              <li style={{ marginBottom: '16px' }}>
                <strong>Discover the Scenario.</strong>
                In the QTP UI, go to <strong>Scenarios</strong> and click the "Discover" button. QTP will scan your codebase and register <code>demo.fetch_user</code>.
              </li>
              <li style={{ marginBottom: '16px' }}>
                <strong>Run and Inspect.</strong>
                Click "Run" on the newly discovered scenario. Once it finishes, click into the Run ID to view the detailed HTTP request, response payload, and assertion results.
              </li>
            </ol>

            <H2 id="targets" icon={<GlobalOutlined />}>Targets & Environments</H2>
            <Paragraph>
              Targets are powerful because they allow you to write <strong>environment-agnostic scenarios</strong>. 
            </Paragraph>
            <Paragraph>
              When authoring, you reference the target by its abstract key (e.g., <code>target="payments_service"</code>). At runtime, QTP resolves this key to a concrete Target configuration. The <code>base_url</code> defined in the target is automatically injected into HTTP calls.
            </Paragraph>
            <Code language="json">{`// Target configuration payload
{
  "key": "payments_service",
  "name": "Payments API (Staging)",
  "base_url": "https://payments.staging.internal",
  "default_headers": {
    "X-Client-Id": "qtp-automation",
    "Authorization": "Bearer static-staging-token"
  }
}`}</Code>
            <Paragraph>
              <strong>Best Practice:</strong> Keep Target keys stable (e.g., <code>users_api</code>). Create separate targets for different environments if needed (e.g., <code>users_api_staging</code>, <code>users_api_prod</code>), or update the <code>base_url</code> dynamically in CI prior to kicking off a run.
            </Paragraph>


            <H2 id="authoring-http" icon={<ApiOutlined />}>Authoring: HTTP APIs</H2>
            <Paragraph>
              The <code>HttpTest</code> base class is optimized for REST and GraphQL APIs. It provides a fluent assertion syntax and automatically logs full request/response payloads as evidence.
            </Paragraph>
            
            <H3>Single-Step Checks</H3>
            <Code language="python">{`from src.testkit import TYPE_HTTP, HttpTest, TestMetadata

class SelfHealth(HttpTest):
    metadata = TestMetadata(
        key="self.health",
        name="QTP · health returns ok",
        type=TYPE_HTTP,
        target="qtp_self"
    )

    def test(self, ctx):
        response = ctx.http.get("/health")

        response.should.have_status(200)
        response.should.respond_within_ms(3000)
        response.json.should.have_field("status").equal_to("ok")
        response.json.should.have_field("service").equal_to("qtp")`}</Code>

            <H3>Stateful Multi-Step Workflows</H3>
            <Paragraph>
              For End-to-End API scenarios, you can group actions into steps and pass state dynamically. For instance, extracting an ID from a POST response and verifying it in a GET request. You can also implement a <code>cleanup</code> block.
            </Paragraph>

            <Code language="python">{`from src.testkit import TYPE_HTTP, HttpTest, TestMetadata

class SelfTargetsCrud(HttpTest):
    metadata = TestMetadata(key="self.auth.targets_crud", name="QTP · Targets CRUD", type=TYPE_HTTP, target="qtp_self")

    def test(self, ctx):
        token = {"type": "bearer", "token": "system-bearer-token"}
        
        with ctx.step("Create Target"):
            response = ctx.http.post("/api/targets", auth=token, json={
                "key": "scn_tgt", "name": "Scenario Target", "base_url": "http://example.com"
            })
            response.should.have_status(201)
            
            # Extract variable for next steps
            target_id = response.json.get("$.id")
            ctx.set_var("target_id", target_id)

        with ctx.step("Get Target"):
            target_id = ctx.get_var("target_id")
            response = ctx.http.get(f"/api/targets/{target_id}", auth=token)
            response.should.have_status(200)
            response.json.should.have_field("target.key").equal_to("scn_tgt")

    def cleanup(self, ctx):
        # Always runs even if test() throws an exception
        target_id = ctx.get_var("target_id")
        if target_id:
            ctx.log("info", f"cleanup: deleting target {target_id}")`}</Code>



            <H2 id="authoring-python" icon={<CodeOutlined />}>Authoring: Python Logic</H2>
            <Paragraph>
              Sometimes you need to do things outside of HTTP, like querying a database, publishing a Kafka message, or validating complex business logic. The <code>PythonTest</code> class gives you a blank canvas.
            </Paragraph>
            <Code language="python">{`from src.testkit import TYPE_PYTHON, PythonTest, TestMetadata
import requests

class ExamplePythonTest(PythonTest):
    metadata = TestMetadata(
        key="qtp_self.python.test_2",
        name="Example.com HTTP (Python)",
        type=TYPE_PYTHON,
        target="qtp_self",
        tags=["python", "http"]
    )

    def test(self, ctx):
        ctx.log('info', 'Running HTTP request test against example.com')

        response = requests.get('https://example.com/', headers={'accept': 'text/html'}, timeout=10)
        
        ctx.log('info', f'Status code: {response.status_code}')

        # Explicitly record assertions in QTP evidence
        ctx.assert_that(
            'status_code',
            'equals',
            response.status_code,
            200,
            True,
            message='Example.com should return 200'
        )

        ctx.assert_that(
            'contains_example_domain',
            'equals',
            'Example Domain' in response.text,
            True,
            True,
            message='Response should contain Example Domain'
        )`}</Code>

            <H2 id="authoring-browser" icon={<DesktopOutlined />}>Authoring: Browser Tests</H2>
            <Paragraph>
              For UI smoke tests, QTP supports Playwright. The <code>PlaywrightTest</code> class provides a managed browser context.
            </Paragraph>
            <Code language="python">{`from src.testkit import TYPE_PLAYWRIGHT, PlaywrightTest, TestMetadata

class QtpSelfPlaywrightTest1(PlaywrightTest):
    metadata = TestMetadata(
        key='qtp_self.browser.test_1',
        name='QTP Self Playwright Test',
        type=TYPE_PLAYWRIGHT,
        target='qtp_self'
    )

    def test(self, ctx):
        # ctx.browser is a managed playwright context wrapper
        page = ctx.browser.visit('https://example.com/').page

        page.wait_for_selector('body', timeout=5000)

        title = page.locator('h1').inner_text(timeout=5000).strip()

        # Playwright assertions are captured in QTP evidence
        ctx.assert_that(
            'example_title',
            'equals',
            title,
            'Example Domain',
            True,
            message='Example.com title should be visible'
        )`}</Code>

            <Paragraph style={{ marginTop: '16px' }}>
              For legacy or specialized grids, QTP also supports Selenium WebDriver via <code>SeleniumTest</code>.
            </Paragraph>
            <Code language="python">{`from src.testkit import TYPE_SELENIUM, SeleniumTest, TestMetadata

class QtpSelfSeleniumTest1(SeleniumTest):
    metadata = TestMetadata(
        key='qtp_self.selenium.test_1',
        name='QTP Self Selenium Test',
        type=TYPE_SELENIUM,
        target='qtp_self'
    )

    def test(self, ctx):
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        
        options = Options()
        options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        driver = webdriver.Chrome(options=options)
        
        try:
            driver.get('https://example.com/')
            
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, 'body'))
            )
            
            title = driver.find_element(By.TAG_NAME, 'h1').text.strip()
            
            ctx.assert_that(
                'example_title',
                'equals',
                title,
                'Example Domain',
                True,
                message='Example.com title should be visible'
            )
        finally:
            driver.quit()`}</Code>

            <H2 id="authoring-cli" icon={<CodeOutlined />}>Authoring: CLI Tools</H2>
            <Paragraph>
              Use <code>CliTest</code> to run shell commands or custom binaries. This is great for infrastructure checks or wrapping existing bash-based scripts.
            </Paragraph>
            <Code language="python">{`from src.testkit import CliTest, TYPE_CLI, TestMetadata

class QtpSelfCliTest1(CliTest):
    metadata = TestMetadata(
        key='qtp_self.cli.test_1',
        name='QTP Self CliTest Test 1',
        type=TYPE_CLI,
        target='qtp_self',
        tags=['qtp_self', 'cli']
    )

    def test(self, ctx):
        # Runs command inside the worker container
        res = ctx.cli.run('curl -s https://dogapi.dog/api/v2/facts')
        
        ctx.log('info', f'CLI Output: {res.stdout[:500]}')
        
        # Validate properties on the result or explicitly record a pass
        ctx.assert_that(
            'command_success',
            'equals', 
            res.exit_code, 
            0, 
            True, 
            message='Command should exit with 0'
        )`}</Code>

            <H2 id="assertions" icon={<SafetyOutlined />}>Assertions & Captures</H2>
            <Paragraph>
              <strong>Assertions are evidence.</strong> A test failure is useless if you don't know what failed. QTP's assertion library guarantees that both the expected value and the actual value are logged to the backend.
            </Paragraph>
            <ul>
              <li><code>.should.have_status(code)</code>: Validates HTTP response codes.</li>
              <li><code>.json.should.have_field("path")</code>: Navigates JSON using dot notation.</li>
              <li><code>.equal_to(val)</code>, <code>.containing(val)</code>, <code>.matching(regex)</code>: Data validation operators.</li>
              <li><code>.with_length_at_least(n)</code>: Array length checks.</li>
            </ul>
            <Paragraph>
              <strong>Captures</strong> allow data to flow between steps. In Request Builder, use the capture UI. In Python:
            </Paragraph>
            <Code language="python">{`# Capture
token = response.json.extract("auth.jwt_token")
ctx.set_var("auth_token", token)

# Use later (manually injected into headers, or using template strings)
ctx.http.get("/secure-data", headers={"Authorization": f"Bearer {ctx.get_var('auth_token')}"})`}</Code>

            <H2 id="request-builder" icon={<ToolOutlined />}>Request Builder</H2>
            <Paragraph>
              Not every test requires writing code. The QTP UI features a full <strong>Request Builder</strong>, similar to Postman, allowing you to define multi-step HTTP workflows directly in the browser.
            </Paragraph>
            <Paragraph>
              Scenarios created via Request Builder are saved natively in QTP. They participate in scheduling, CI integrations, and metrics just like code scenarios. Under the hood, they are stored as JSON configurations:
            </Paragraph>
            <Code language="json">{`{
  "name": "Auth and Fetch Profile (UI Built)",
  "config": {
    "target": "users_api",
    "steps": [
      {
        "id": "login",
        "method": "POST",
        "url": "/api/login",
        "body": {"mode": "json", "raw": "{\\"user\\":\\"alice\\"}"},
        "captures": [{"name": "token", "source": "json_path", "path": "$.token"}],
        "assertions": [{"type": "status_code", "operator": "equals", "expected": 200}]
      },
      {
        "id": "profile",
        "method": "GET",
        "url": "/api/me",
        "headers": [{"name": "Authorization", "value": "Bearer {{token}}"}],
        "assertions": [
          {"type": "json_path", "path": "$.role", "operator": "equals", "expected": "admin"}
        ]
      }
    ]
  }
}`}</Code>

            <H2 id="scheduling" icon={<ScheduleOutlined />}>Scheduling</H2>
            <Paragraph>
              Schedules act as the heartbeat of your system's quality. You can group multiple scenarios into a "Pack" and run them periodically.
            </Paragraph>
            <Paragraph>
              <strong>Common Scheduling Patterns:</strong>
            </Paragraph>
            <ul>
              <li><strong>Continuous Monitoring:</strong> Run critical <code>P0</code> scenarios every 5 minutes. (Use <code>interval: 300</code>).</li>
              <li><strong>Nightly Batch:</strong> Run long end-to-end regression suites at 2 AM every day. (Use <code>cron: "0 2 * * *"</code>).</li>
            </ul>
            <Paragraph>
              When a schedule fires, it generates an overarching <code>ScheduleRun</code> which aggregates the results of all individual scenario runs, providing a unified pass/fail metric.
            </Paragraph>

            <H2 id="execution" icon={<DashboardOutlined />}>Execution & Results</H2>
            <Paragraph>
              When a scenario executes, QTP records every granular detail. Navigate to a Run's detail page to debug:
            </Paragraph>
            <ul>
              <li><strong>Timeline:</strong> Shows step execution time to spot performance regressions.</li>
              <li><strong>Assertion View:</strong> A diff view showing exactly what was expected vs. what was received.</li>
              <li><strong>Raw Request/Response:</strong> Complete HTTP headers and body payloads for deep debugging.</li>
              <li><strong>Worker Logs:</strong> Standard output from Python or the CLI worker.</li>
            </ul>
            <Paragraph>
              <strong>Status Lifecycle:</strong>
              <br/>
              <code>Queued</code> ➔ <code>Running</code> ➔ <Tag color="green">Passed</Tag> | <Tag color="red">Failed</Tag> | <Tag color="orange">Error</Tag> | <Tag color="gold">Timeout</Tag>
            </Paragraph>
            <Paragraph>
              To help with metrics, developers can categorize failures (e.g., tagging a failure as a <code>product_bug</code> vs <code>automation_bug</code>), which feeds directly into the QTP Dashboards.
            </Paragraph>

            <H2 id="ci" icon={<DeploymentUnitOutlined />}>CI/CD Integration</H2>
            <Paragraph>
              The most powerful use of QTP is gating your deployments. Your CI tool shouldn't execute the tests itself; it should trigger QTP, wait for the result, and fail the pipeline if QTP reports a failure.
            </Paragraph>
            <Paragraph>
              Here is how you can embed QTP into modern CI pipelines to act as a quality gate:
            </Paragraph>
            
            <H3>GitHub Actions</H3>
            <Code language="yaml">{`name: QTP E2E Tests
on: [deployment_status]

jobs:
  run_qtp_tests:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - name: Trigger and Poll QTP Scenario
        env:
          QTP_URL: \${{ secrets.QTP_URL }}
          QTP_TOKEN: \${{ secrets.QTP_TOKEN }}
          SCENARIO_ID: "checkout.e2e"
        run: |
          RUN_RESP=$(curl -sf -X POST "$QTP_URL/api/tests/$SCENARIO_ID/run" \\
            -H "Authorization: Bearer $QTP_TOKEN" -H "Content-Type: application/json" -d '{"tags": ["github-actions"]}')
          RUN_ID=$(echo "$RUN_RESP" | jq -r '.id')
          echo "Run initiated: $RUN_ID"
          
          STATUS="running"
          while [ "$STATUS" = "running" ] || [ "$STATUS" = "queued" ]; do
            sleep 5
            STATUS=$(curl -sf -X GET "$QTP_URL/api/runs/$RUN_ID" -H "Authorization: Bearer $QTP_TOKEN" | jq -r '.status')
          done
          
          if [ "$STATUS" != "passed" ]; then
            echo "Test failed with status: $STATUS"
            exit 1
          fi`}</Code>

            <H3>GitLab CI</H3>
            <Code language="yaml">{`qtp_e2e_tests:
  stage: test
  image: alpine:latest
  before_script:
    - apk add --no-cache curl jq
  variables:
    SCENARIO_ID: "checkout.e2e"
  script:
    - |
      RUN_RESP=$(curl -sf -X POST "$QTP_URL/api/tests/$SCENARIO_ID/run" \\
        -H "Authorization: Bearer $QTP_TOKEN" -H "Content-Type: application/json" -d '{"tags": ["gitlab-ci"]}')
      RUN_ID=$(echo "$RUN_RESP" | jq -r '.id')
      echo "Run initiated: $RUN_ID"
      
      STATUS="running"
      while [ "$STATUS" = "running" ] || [ "$STATUS" = "queued" ]; do
        sleep 5
        STATUS=$(curl -sf -X GET "$QTP_URL/api/runs/$RUN_ID" -H "Authorization: Bearer $QTP_TOKEN" | jq -r '.status')
      done
      
      if [ "$STATUS" != "passed" ]; then
        echo "Test failed with status: $STATUS"
        exit 1
      fi`}</Code>

            <H2 id="api" icon={<ApiOutlined />}>API Reference</H2>
            <Paragraph>
              Everything you can do in the QTP UI can be done via the REST API. Authenticate requests using a Bearer token in the <code>Authorization</code> header.
            </Paragraph>
            <ApiTable />

            <H2 id="extend" icon={<BuildOutlined />}>Extending QTP</H2>
            <Paragraph>
              If your organization uses specialized protocols (e.g., gRPC, AMQP) or bespoke testing utilities, you can extend QTP by creating new scenario adapter types.
            </Paragraph>
            <ol className="qtp-docs-steps" style={{ paddingLeft: '20px', margin: '20px 0' }}>
              <li>Define a new constant in <code>src/testkit/base.py</code> (e.g., <code>TYPE_GRPC</code>).</li>
              <li>Create a base class <code>GrpcTest(BaseTest)</code> with custom setup/teardown logic.</li>
              <li>Provide context helpers (e.g., <code>ctx.grpc.invoke()</code>) that wrap the underlying driver and record assertions to QTP's evidence format.</li>
              <li>Ensure the Worker Docker image includes the necessary client libraries.</li>
            </ol>

            <H2 id="troubleshooting" icon={<BugOutlined />}>Troubleshooting</H2>
            <H3>Scenario does not appear after discovery</H3>
            <ul style={{ marginBottom: '16px' }}>
              <li>Check the file path. Code must live under <code>backend/scenarios/automation/</code>.</li>
              <li>Verify the class inherits from a known QTP base class (e.g., <code>HttpTest</code>).</li>
              <li>Ensure the <code>metadata.key</code> is globally unique across the codebase.</li>
              <li>Look at the API response from the <code>/discover</code> endpoint for syntax or import errors.</li>
            </ul>
            <H3>Run remains stuck in "Queued" state</H3>
            <ul style={{ marginBottom: '16px' }}>
              <li>No workers are available. Go to the <strong>Workers</strong> page to check heartbeat freshness.</li>
              <li>The scenario requires a capability (e.g., <code>browser</code>) that none of the active workers possess.</li>
              <li>The worker pool is overwhelmed. Check if runs are backed up.</li>
            </ul>
            <H3>HTTP Target requests are timing out</H3>
            <ul>
              <li>Network isolation: Ensure the Worker container has network egress to the Target URL.</li>
              <li>SSRF protections: QTP workers may block requests to internal IPs (<code>10.x.x.x</code>, <code>127.0.0.1</code>) by default unless explicitly whitelisted in the platform configuration.</li>
            </ul>
          </article>
        </Col>
      </Row>
    </div>
  );
}
