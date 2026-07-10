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
  SafetyOutlined,
  ScheduleOutlined,
  ToolOutlined,
  ReadOutlined,
  AppstoreAddOutlined,
  GlobalOutlined,
  DashboardOutlined,
  DesktopOutlined,
  BranchesOutlined,
  KeyOutlined,
  ProfileOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { Callout } from "fumadocs-ui/components/callout";
import { Card as FumaCard, Cards } from "fumadocs-ui/components/card";
import "fumadocs-ui/style.css";
import CodeSnippet from "../components/CodeSnippet";

const { Paragraph, Text } = Typography;

/** Documentation anchors, also consumed by the command palette (Ctrl/⌘K) so
 *  "search docs" stays in sync with the page's own section list. */
export const sections = [
  { id: "overview", title: "Overview" },
  { id: "scope-use-cases", title: "Scope & Use Cases" },
  { id: "architecture", title: "Architecture & Integration" },
  { id: "mental-model", title: "Core Concepts" },
  { id: "lifecycle", title: "Scenario Lifecycle" },
  { id: "quickstart", title: "Developer Quickstart" },
  { id: "project-layout", title: "Repository Layout & Discovery" },
  { id: "targets", title: "Targets & Environments" },
  { id: "authoring-http", title: "Authoring: HTTP APIs" },
  { id: "authoring-python", title: "Authoring: Python Logic" },
  { id: "authoring-browser", title: "Authoring: Browser Tests" },
  { id: "authoring-cli", title: "Authoring: CLI Tools" },
  { id: "assertions", title: "Assertions Reference" },
  { id: "variables-secrets", title: "Variables, Templating & Secrets" },
  { id: "steps-evidence", title: "Steps, Logging & Evidence" },
  { id: "request-builder", title: "Request Builder" },
  { id: "scheduling", title: "Scheduling" },
  { id: "execution", title: "Execution & Results" },
  { id: "defect-triage", title: "Defect Triage" },
  { id: "ci", title: "CI/CD Integration" },
  { id: "api", title: "API Reference" },
  { id: "patterns", title: "Patterns & Best Practices" },
  { id: "extend", title: "Extending QTP" },
  { id: "troubleshooting", title: "Troubleshooting & FAQ" },
];

const navGroups = [
  { title: "Introduction", items: ["overview", "scope-use-cases", "architecture", "mental-model", "lifecycle"] },
  { title: "Getting Started", items: ["quickstart", "project-layout", "targets"] },
  { title: "Authoring Scenarios", items: ["authoring-http", "authoring-python", "authoring-browser", "authoring-cli", "assertions", "variables-secrets", "steps-evidence", "request-builder"] },
  { title: "Operations", items: ["scheduling", "execution", "defect-triage", "ci", "api"] },
  { title: "Advanced", items: ["patterns", "extend", "troubleshooting"] },
];

const apiEndpoints = [
  ["GET", "/api/me", "Current developer identity, roles, and permissions."],
  ["GET", "/api/projects", "List projects (workspaces) visible to the caller."],
  ["GET", "/api/targets", "List registered applications under test."],
  ["POST", "/api/targets", "Register a target for a service or environment."],
  ["GET", "/api/targets/{id}", "Read a single target and its configuration."],
  ["PATCH", "/api/targets/{id}", "Update a target's base URL, headers, or tags."],
  ["DELETE", "/api/targets/{id}", "Delete a target."],
  ["GET", "/api/targets/{id}/tests", "List scenarios that belong to a target."],
  ["GET", "/api/targets/{id}/runs", "List runs for a target."],
  ["GET", "/api/targets/{id}/stats", "Pass/fail ratios and trends for a target."],
  ["POST", "/api/targets/{id}/reset-stats", "Reset a target's cached statistics."],
  ["POST", "/api/targets/{id}/run-all", "Queue every scenario for a target (add ?sync=true to block)."],
  ["GET", "/api/scenarios", "List scenario definitions (the UI route is /scenarios)."],
  ["POST", "/api/scenarios/discover", "Import code-backed scenarios from the repository."],
  ["GET", "/api/scenarios/{id}", "Read a scenario, its revisions, and recent runs."],
  ["DELETE", "/api/scenarios/{id}", "Delete a scenario."],
  ["POST", "/api/scenarios/{id}/run", "Queue a run immediately for one scenario."],
  ["PUT", "/api/scenarios/{id}/tags", "Replace the tag set on a scenario."],
  ["GET", "/api/scenarios/{id}/comments", "List triage comments on a scenario."],
  ["POST", "/api/scenarios/{id}/comments", "Add a comment (with optional tags) to a scenario."],
  ["POST", "/api/request-tests/send", "Execute a Request Builder config ad hoc (no save)."],
  ["POST", "/api/request-tests/generate-assertions", "AI-suggest assertions from a captured response."],
  ["POST", "/api/request-tests", "Persist a Request Builder scenario."],
  ["PATCH", "/api/request-tests/{id}", "Update a saved Request Builder scenario (new revision)."],
  ["DELETE", "/api/request-tests/{id}", "Delete a saved Request Builder scenario."],
  ["GET", "/api/runs", "Search execution history — filtered, sorted, paginated on the server."],
  ["DELETE", "/api/runs", "Delete all runs (destructive)."],
  ["GET", "/api/runs/{id}", "Read steps, assertions, response, timings, and failure metadata."],
  ["DELETE", "/api/runs/{id}", "Permanently delete a specific run."],
  ["GET", "/api/runs/{id}/logs", "Stream the structured log lines for a run."],
  ["GET", "/api/runs/{id}/comments", "List triage comments on a run."],
  ["POST", "/api/runs/{id}/comments", "Add a comment (with optional tags) to a run."],
  ["POST", "/api/runs/{id}/cancel", "Request cancellation of a queued or running execution."],
  ["POST", "/api/runs/{id}/restart", "Restart this run in place (re-queue the same run)."],
  ["POST", "/api/runs/{id}/re-run", "Queue a fresh run from the same scenario revision."],
  ["PUT", "/api/runs/{id}/defect", "Classify a failure (product_bug, automation_bug, …)."],
  ["POST", "/api/runs/re-run-queued", "Re-dispatch every stuck queued run."],
  ["POST", "/api/runs/restart-failed", "Re-queue every failed/errored run."],
  ["GET", "/api/schedules", "List schedules and their next fire times."],
  ["POST", "/api/schedules", "Create a schedule for one or more scenarios."],
  ["GET", "/api/schedules/{id}", "Read a schedule, its scenarios, and recent aggregate runs."],
  ["PATCH", "/api/schedules/{id}", "Update a schedule (cadence, scenarios, enabled)."],
  ["DELETE", "/api/schedules/{id}", "Delete a schedule."],
  ["GET", "/api/dashboards/overview", "Operational metrics over a time window."],
  ["GET", "/api/dashboards/failures", "Failure signatures, defect split, recent failed runs."],
  ["GET", "/api/workers", "Live worker fleet — capabilities, current run, heartbeat."],
  ["GET", "/api/tags", "All tags in use, for building filters."],
  ["GET", "/api/audit", "Global audit event ledger (who did what, when)."],
  ["GET", "/api/audit/{type}/{id}", "Audit trail for one entity (run, scenario, schedule, …)."],
];

const scenarioTypes = [
  ["HttpTest", "ctx.http", "REST / GraphQL / any HTTP service", "Fluent request + response assertions; full request/response captured as evidence. Best default for API checks."],
  ["PythonTest", "any Python", "Custom logic, DBs, queues, SDKs", "A blank canvas. Import any library, call any SDK, and record explicit assertions with ctx.assert_that."],
  ["CliTest", "ctx.cli", "Command-line tools & containers", "Run shell commands or CLIs (curl, k6, newman, your own binary) and assert on exit code, stdout, stderr, and duration."],
  ["PlaywrightTest", "ctx.browser", "Modern browser workflows", "Chromium page automation with an auto-captured network waterfall, console, and page errors. Needs a Playwright worker image."],
  ["SeleniumTest", "WebDriver", "Legacy / grid-based UI suites", "Drive a Selenium WebDriver directly for suites that need a specific grid or legacy support."],
];

const operatorRows: [string, string, string][] = [
  ["equals / not_equals", "any", "Exact match (compared as value and as string)."],
  ["contains / not_contains", "string", "Substring presence in the actual value."],
  ["matches / not_matches", "regex", "Python regex search against the actual value."],
  ["gt / gte / lt / lte", "number", "Numeric comparison; both sides coerced to float."],
  ["length_eq / length_gte / length_lte", "collection", "Compares len(actual) against the expected number."],
  ["in / not_in", "list", "Membership of the actual value in an expected list."],
  ["exists / not_exists", "—", "Whether the field/header/path is present at all."],
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
  return <CodeSnippet language={language} code={children} />;
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

function DataTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  const { token } = theme.useToken();
  return (
    <div className="qtp-docs-table" style={{ overflowX: 'auto', marginTop: '1em' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${token.colorBorderSecondary}` }}>
            {head.map((h) => <th key={h} style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
              {r.map((c, j) => <td key={j} style={{ padding: '10px 8px', verticalAlign: 'top' }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
              <td style={{ padding: '10px 8px' }}><Tag color={method === 'GET' ? 'blue' : method === 'POST' ? 'green' : method === 'DELETE' ? 'red' : 'gold'}>{method}</Tag></td>
              <td style={{ padding: '10px 8px' }}><code style={{ whiteSpace: 'nowrap' }}>{endpoint}</code></td>
              <td style={{ padding: '10px 8px' }}>{use}</td>
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
    <div className="qtp-docs-page" style={{ padding: '24px' }}>
      <Row gutter={48} align="top" wrap={false}>
        <Col xs={0} lg={5} className="qtp-docs-nav-col" style={{ position: 'sticky', top: '24px', height: 'calc(100vh - 48px)', overflowY: 'auto' }}>
          <aside className="qtp-docs-side-nav" aria-label="Documentation navigation">
            <div className="qtp-docs-brand" style={{ fontSize: '0.9rem', fontWeight: 650, marginBottom: '14px', color: token.colorText }}>
              <img className="qtp-docs-logo" src="/qtp-logo.svg" alt="" />
              <span>QTP Developer Guide</span>
            </div>
            {navGroups.map((group) => (
              <nav key={group.title} style={{ marginBottom: '14px' }}>
                <div className="qtp-docs-nav-title" style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: token.colorTextTertiary, fontWeight: 700, marginBottom: '4px' }}>{group.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  {group.items.map((id) => (
                    <a key={id} href={`#${id}`} style={{ color: token.colorTextSecondary, textDecoration: 'none', fontSize: '0.8rem', lineHeight: 1.35 }}>{slugTitle(id)}</a>
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
                Build reliable automation with QTP
              </h1>
              <p style={{ fontSize: '1.25rem', color: token.colorTextSecondary }}>
                QTP (Quality Testing Platform) is a testing control plane and authoring framework for developers.
                Write scenarios as ordinary Python — or build them no-code in the browser — and QTP discovers,
                runs, schedules, and deeply inspects them against any environment, from a single unified platform.
              </p>
            </div>

            <Cards className="qtp-docs-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '3rem' }}>
              <FumaCard icon={<CodeOutlined />} title="Author Anywhere" description="Write scenarios in Python, drive HTTP/CLI/browser, or use the no-code Request Builder." />
              <FumaCard icon={<CloudServerOutlined />} title="Environment Agnostic" description="Run the same scenario against local, staging, or production by swapping a Target." />
              <FumaCard icon={<BugOutlined />} title="Deep Diagnostics" description="Step timelines, exact assertions, full payloads, logs, and a network waterfall." />
              <FumaCard icon={<DeploymentUnitOutlined />} title="CI/CD Native" description="Trigger and gate deployments through a first-class REST API." />
            </Cards>

            <Callout title="Who this guide is for" type="info">
              This guide is written for <strong>developers and testers</strong> who use QTP to author, schedule, and debug
              scenarios. It covers the authoring framework, the mental model, the REST API, and CI integration. It
              intentionally leaves out platform administration (deploying QTP, scaling workers, Keycloak setup) — that
              lives in the operator docs.
            </Callout>

            {/* ─────────────────────────── OVERVIEW ─────────────────────────── */}
            <H2 id="overview" icon={<ReadOutlined />}>Overview</H2>
            <Paragraph>
              As software systems grow, verification becomes scattered. API tests live in Postman collections, UI tests
              in a CI job, integration checks in a bash script, and smoke tests in a cron somewhere. When something
              breaks, engineers hunt across four systems to reconstruct what actually happened.
            </Paragraph>
            <Paragraph>
              <strong>QTP consolidates this into a single testing control plane.</strong> You write scenarios as standard
              Python in your repository (or build them visually), and QTP discovers them, executes them on a fleet of
              workers against the environment you choose, and stores a rich, queryable record of every run — steps,
              assertions, request/response payloads, logs, timings, and a network waterfall.
            </Paragraph>
            <Paragraph>
              Conceptually, QTP unifies two capabilities that usually live in separate tools:
            </Paragraph>
            <ul>
              <li><strong>An execution control plane</strong>: it owns scenario definitions, schedules, a durable run queue, and horizontally-scaled workers that do the actual running.</li>
              <li><strong>A reporting system</strong>: a centralized history of every run with dashboards, failure grouping by signature, and defect-type triage.</li>
            </ul>
            <Paragraph>
              The result: one place to define what "working" means, one place to run it, and one place to see why it
              failed.
            </Paragraph>

            {/* ─────────────────────── SCOPE & USE CASES ─────────────────────── */}
            <H2 id="scope-use-cases" icon={<AppstoreAddOutlined />}>Scope &amp; Use Cases</H2>
            <Paragraph>
              QTP is deliberately technology-agnostic about <em>what</em> you verify. Because a scenario is just code with
              access to an HTTP client, a shell, a browser, and the full Python ecosystem, it spans a wide range of
              validation strategies:
            </Paragraph>
            <ul>
              <li><strong>Continuous delivery gates.</strong> Trigger a regression suite from Jenkins, GitLab CI, or GitHub Actions after a deploy and fail the pipeline if QTP reports a failure.</li>
              <li><strong>Production smoke &amp; synthetic monitoring.</strong> Schedule lightweight HTTP checks every few minutes against production to confirm core flows (login, checkout, search) stay healthy.</li>
              <li><strong>End-to-end workflows.</strong> Write stateful, multi-service scenarios — create a user via API, mutate data via a DB driver, then verify the result in the UI with Playwright.</li>
              <li><strong>Contract &amp; schema checks.</strong> Assert response shapes, status codes, headers, and field-level values so a breaking change is caught the moment it ships.</li>
              <li><strong>Environment promotion.</strong> Run the identical suite against <code>staging</code> and <code>production</code> by pointing the Target at a different base URL.</li>
              <li><strong>Reliability triage.</strong> When a check fails, tag it as a <code>product_bug</code>, <code>automation_bug</code>, or <code>system_issue</code> to separate real defects from flaky tests and infra noise.</li>
            </ul>
            <Callout title="What QTP is not" type="warn">
              QTP is not a unit-test runner and not a load-testing tool. It excels at <em>black-box</em>, environment-facing
              checks — driving a deployed system through its real interfaces (HTTP, browser, CLI) and recording evidence.
              Keep pytest for in-process unit tests; reach for a dedicated load tool for sustained high-RPS benchmarking
              (though you can invoke one from a <code>CliTest</code>).
            </Callout>

            {/* ─────────────────────── ARCHITECTURE ─────────────────────── */}
            <H2 id="architecture" icon={<DeploymentUnitOutlined />}>Architecture &amp; Integration</H2>
            <Paragraph>
              You don't need to operate QTP to author for it, but a mental model of the moving parts explains why
              scenarios behave the way they do — why a run is queued before it runs, why workers need capabilities, and
              why the same code hits different environments.
            </Paragraph>
            <H3>The pieces</H3>
            <ul>
              <li><strong>Control plane (Backend &amp; UI).</strong> A Flask API plus the React app you're reading this in. It owns scenario definitions, revisions, schedules, targets, and the run history, and exposes everything as REST.</li>
              <li><strong>Scheduler.</strong> Merged into the backend as a lightweight greenlet (not a separate service). It watches for due schedules and enqueues runs. A database advisory lock guarantees exactly one scheduler is active across all backend replicas.</li>
              <li><strong>Run queue (Kafka + Postgres).</strong> When a run is requested, the backend records it as <code>queued</code> and publishes its id to a partitioned Kafka topic. This decouples "asking for a run" from "running it".</li>
              <li><strong>Workers.</strong> A horizontally-scaled pool that consumes run ids from Kafka, loads the scenario and its target, executes it, and streams steps, assertions, and logs back to Postgres in real time. Workers advertise <strong>capabilities</strong> (http, python, cli, playwright, selenium); a run only lands on a worker that can serve it.</li>
              <li><strong>Your repository.</strong> Code-backed scenarios live in your Git repo under <code>backend/scenarios/automation/</code>. QTP imports them on demand via the discovery endpoint.</li>
            </ul>
            <H3>How your code flows through the system</H3>
            <ol className="qtp-docs-steps" style={{ paddingLeft: '20px', margin: '20px 0' }}>
              <li style={{ marginBottom: '10px' }}>You push a scenario file to your repo.</li>
              <li style={{ marginBottom: '10px' }}>A CI step (or a click in the UI) calls <code>/api/scenarios/discover</code>. QTP imports the file, reads its <code>metadata</code>, and registers or revises the scenario.</li>
              <li style={{ marginBottom: '10px' }}>A schedule fires, a CI job calls <code>/api/scenarios/&#123;id&#125;/run</code>, or you click <strong>Run</strong>. The backend writes a <code>queued</code> run and publishes its id to Kafka.</li>
              <li style={{ marginBottom: '10px' }}>A worker with the right capability claims the run, resolves the Target's base URL, and executes your <code>test(ctx)</code>.</li>
              <li style={{ marginBottom: '10px' }}>Every request, assertion, log line, and timing is streamed back. The run ends in a terminal state and becomes permanent, queryable evidence.</li>
            </ol>
            <Callout title="Why runs are asynchronous" type="info">
              Because execution is queue-backed, a run is <code>queued</code> the instant you request it and only becomes
              <code> running</code> when a worker picks it up. For CI gating you either <strong>poll</strong> the run until it
              reaches a terminal state, or request a <strong>synchronous</strong> run where supported (for example{' '}
              <code>?sync=true</code> on target run-all). See <a href="#ci">CI/CD Integration</a>.
            </Callout>

            {/* ─────────────────────── MENTAL MODEL ─────────────────────── */}
            <H2 id="mental-model" icon={<CloudServerOutlined />}>Core Concepts &amp; Mental Model</H2>
            <Paragraph>
              Five entities describe everything in QTP. Internalize these and the rest of the product is obvious.
            </Paragraph>
            <DataTable
              head={["Entity", "What it is", "Key fields"]}
              rows={[
                [<Text strong>Target</Text>, "The system under test. Abstracts an environment behind a stable key so scenarios never hard-code a URL.", <code>key, base_url, default_headers, environment, tags</code>],
                [<Text strong>Scenario</Text>, "The logical definition of what you verify — one Python class, or one Request Builder config.", <code>key, name, type, target, tags, owner</code>],
                [<Text strong>Revision</Text>, "An immutable snapshot of a scenario's configuration. Discovery creates a new revision when the definition changes.", <code>revision number, config, created_at</code>],
                [<Text strong>Run</Text>, "A single execution of a specific revision. Produces evidence and ends in a terminal status.", <code>status, steps, assertions, duration, defect_type</code>],
                [<Text strong>Schedule</Text>, "A rule that triggers runs automatically on an interval or cron, across one or more scenarios.", <code>recurrence, target, scenarios, next_run_at</code>],
              ]}
            />
            <Paragraph style={{ marginTop: '1.5em' }}>
              The relationships nest cleanly — a Target owns Scenarios, a Scenario accumulates Revisions, and each Run
              belongs to exactly one Revision:
            </Paragraph>
            <Code language="text">{`Target (staging_api)
  └── Scenario (login_flow)
       ├── Revision (v1)
       │    └── Run #104   passed
       └── Revision (v2)   ← created when the code changed
            ├── Run #105   failed   → triaged: automation_bug
            └── Run #106   passed`}</Code>
            <Paragraph>
              Because every Run pins a Revision, history stays honest: a run from last week reflects the code as it was
              last week, even after you have changed the scenario since.
            </Paragraph>

            {/* ─────────────────────── LIFECYCLE ─────────────────────── */}
            <H2 id="lifecycle" icon={<BranchesOutlined />}>Scenario Lifecycle</H2>
            <Paragraph>
              Every scenario — regardless of type — runs through the same five lifecycle hooks. You implement only the
              ones you need; the rest are no-ops. This is what makes a read-only check trivial and a stateful workflow
              safe.
            </Paragraph>
            <Code language="text">{`validate_config  →  setup  →  test  →  cleanup  →  teardown
                                 │         │           │
              (build the plan)   │         │           └─ release sessions/browsers/drivers
                                 │         └─ undo side effects (runs on success AND failure)
                                 └─ your assertions; first failed assertion stops the run`}</Code>
            <DataTable
              head={["Hook", "When", "Typical use"]}
              rows={[
                [<code>validate_config</code>, "At discovery time", "Reject a misconfigured scenario early (bad default_config)."],
                [<code>setup(ctx)</code>, "Before test", "Seed a fixture, authenticate once, prepare state."],
                [<code>test(ctx)</code>, "The run", "Drive the target and record assertions. Required."],
                [<code>cleanup(ctx)</code>, "After test — always", "Undo what test created (DELETE a resource a POST made)."],
                [<code>teardown(ctx)</code>, "Last — always", "Close HTTP sessions, browsers, and drivers."],
              ]}
            />
            <Callout title="cleanup always runs" type="info">
              <code>cleanup</code> and <code>teardown</code> execute even when <code>test</code> raised or an assertion
              failed. A failure inside <code>cleanup</code> is recorded (surfaced as the <strong>Cleanup</strong> column on the
              Runs page) but does <em>not</em> change the run's pass/fail verdict — so a leaked resource is visible without
              masking the real result. GET-only scenarios can skip <code>cleanup</code> entirely.
            </Callout>
            <Paragraph>
              Assertions are <strong>fail-fast</strong>: the first failed assertion raises, stops <code>test</code>, and marks the
              run <code>failed</code>. An unexpected exception (a bug in the scenario, an unreachable host) marks it{' '}
              <code>error</code> instead — so you can tell "the app is wrong" apart from "the test is wrong".
            </Paragraph>

            {/* ─────────────────────── QUICKSTART ─────────────────────── */}
            <H2 id="quickstart" icon={<ExperimentOutlined />}>Developer Quickstart</H2>
            <Paragraph>
              Get your first scenario running end-to-end in four steps.
            </Paragraph>
            <ol className="qtp-docs-steps" style={{ paddingLeft: '20px', margin: '20px 0' }}>
              <li style={{ marginBottom: '16px' }}>
                <strong>Create a Target.</strong> In the UI go to <strong>Targets → New target</strong>. Give it a key like{' '}
                <code>example_api</code> and a base URL such as <code>https://jsonplaceholder.typicode.com</code>. The key is
                how your code will address it.
              </li>
              <li style={{ marginBottom: '16px' }}>
                <strong>Write the scenario.</strong> Add a file at{' '}
                <code>backend/scenarios/automation/example_api/fetch_user.py</code>:
                <Code language="python">{`from src.testkit import HttpTest, TestMetadata, TYPE_HTTP


class FetchUser(HttpTest):
    metadata = TestMetadata(
        key="example.fetch_user",
        name="Example · fetch user #1",
        type=TYPE_HTTP,
        target="example_api",          # matches the Target key
        tags=["example", "smoke"],
    )

    def test(self, ctx):
        resp = ctx.http.get("/users/1")

        resp.should.have_status(200)
        resp.should.respond_within_ms(3000)
        resp.json.should.have_field("email").exists()
        resp.json.should.have_field("id").equal_to(1)`}</Code>
              </li>
              <li style={{ marginBottom: '16px' }}>
                <strong>Discover it.</strong> Open <strong>Scenarios</strong> and click <strong>Discover code scenarios</strong> (or
                call <code>POST /api/scenarios/discover</code> from CI). QTP imports the file and registers{' '}
                <code>example.fetch_user</code>.
              </li>
              <li style={{ marginBottom: '16px' }}>
                <strong>Run &amp; inspect.</strong> Click <strong>Run</strong>. When it finishes, open the run to see the exact
                request, the response body, each assertion with expected-vs-actual, the step timeline, and the network
                waterfall.
              </li>
            </ol>

            {/* ─────────────────────── PROJECT LAYOUT ─────────────────────── */}
            <H2 id="project-layout" icon={<ProfileOutlined />}>Repository Layout &amp; Discovery</H2>
            <Paragraph>
              Code-backed scenarios live under <code>backend/scenarios/automation/</code>, organized as one directory per
              target. Discovery walks this tree recursively, imports every module, and registers each class that
              subclasses a QTP base and declares <code>metadata</code>.
            </Paragraph>
            <Code language="text">{`backend/scenarios/automation/
├── example_api/
│   ├── fetch_user.py          → scenarios.automation.example_api.fetch_user
│   └── create_post.py
├── payments/
│   ├── checkout_e2e.py
│   └── _helpers.py            ← leading underscore: a helper, NOT discovered
└── qtp_self/                  ← the platform's own self-tests
    ├── health.py
    └── targets_crud.py`}</Code>
            <H3>Discovery rules</H3>
            <ul>
              <li>Every <code>.py</code> file is imported as <code>scenarios.automation.&lt;dir&gt;.&lt;module&gt;</code>. Adding a new target directory needs <strong>no</strong> registration step.</li>
              <li>Files named <code>__init__.py</code> or starting with an underscore (<code>_helpers.py</code>) are treated as helpers and skipped — put shared code there.</li>
              <li>A class is registered only if it subclasses a QTP base (<code>HttpTest</code>, <code>PythonTest</code>, …) and defines a <code>metadata</code> attribute. Imported base/helper classes are ignored.</li>
              <li><code>metadata.key</code> must be <strong>globally unique</strong>. A duplicate key fails discovery loudly rather than silently overwriting.</li>
              <li>Discovery calls <code>validate_config</code> on each class, so a malformed scenario is caught at import time, not at run time.</li>
            </ul>
            <H3>The metadata contract</H3>
            <Paragraph>Every scenario declares a <code>TestMetadata</code>. These fields drive routing, filtering, and display:</Paragraph>
            <DataTable
              head={["Field", "Required", "Purpose"]}
              rows={[
                [<code>key</code>, "yes", "Globally-unique id used by the API and CI. Use dotted names, e.g. checkout.success."],
                [<code>name</code>, "yes", "Human-readable label shown throughout the UI."],
                [<code>type</code>, "yes", "One of TYPE_HTTP, TYPE_PYTHON, TYPE_CLI, TYPE_PLAYWRIGHT, TYPE_SELENIUM — selects worker capability."],
                [<code>target</code>, "yes*", "The Target key to resolve for ctx.http / ctx.browser. Defaults to \"default\"."],
                [<code>tags</code>, "no", "Free-form labels for grouping, scheduling, and filtering (e.g. smoke, p0, nightly)."],
                [<code>owner</code>, "no", "Who owns the scenario — surfaced in the UI and audit trail."],
                [<code>default_config</code>, "no", "Adapter defaults (timeouts, headers) validated at discovery."],
              ]}
            />

            {/* ─────────────────────── TARGETS ─────────────────────── */}
            <H2 id="targets" icon={<GlobalOutlined />}>Targets &amp; Environments</H2>
            <Paragraph>
              Targets are what make a scenario <strong>environment-agnostic</strong>. Your code references a target by its
              abstract <code>key</code>; at run time QTP resolves that key to a concrete configuration and injects the
              <code> base_url</code> and default headers into every request.
            </Paragraph>
            <Code language="json">{`{
  "key": "payments_service",
  "name": "Payments API (Staging)",
  "base_url": "https://payments.staging.internal",
  "environment": "staging",
  "default_headers": {
    "X-Client-Id": "qtp-automation"
  },
  "tags": ["api", "payments"]
}`}</Code>
            <Paragraph>
              In the scenario you then write relative paths, and the base URL is prepended automatically:
            </Paragraph>
            <Code language="python">{`# target="payments_service" resolves the base URL for you
ctx.http.get("/v1/charges")          # → https://payments.staging.internal/v1/charges
ctx.http.get("https://other/health") # absolute URLs are used as-is`}</Code>
            <Callout title="Environment strategy" type="info">
              Two common patterns: (1) keep one Target per logical service and rewrite its <code>base_url</code> in CI
              before a run, or (2) create one Target per environment (<code>users_api_staging</code>,{' '}
              <code>users_api_prod</code>) and choose which to run. Either way, the <em>scenario code never changes</em> —
              only the Target does. Keep target keys stable; they are referenced by every scenario that uses them.
            </Callout>

            {/* ─────────────────────── HTTP ─────────────────────── */}
            <H2 id="authoring-http" icon={<ApiOutlined />}>Authoring: HTTP APIs</H2>
            <Paragraph>
              <code>HttpTest</code> is the default base for REST and GraphQL. It gives you a target-bound client at{' '}
              <code>ctx.http</code> and a fluent assertion surface on every response. Requests and responses are captured
              in full as run evidence, and every call feeds the network waterfall automatically.
            </Paragraph>
            <H3>The client surface</H3>
            <Paragraph>
              <code>ctx.http</code> exposes <code>get</code>, <code>post</code>, <code>put</code>, <code>patch</code>,{' '}
              <code>delete</code>, and <code>head</code> (all thin wrappers over <code>request</code>). Every verb accepts
              the same keyword arguments:
            </Paragraph>
            <DataTable
              head={["Argument", "Type", "Meaning"]}
              rows={[
                [<code>json=</code>, "dict/list", "JSON body; sets Content-Type: application/json."],
                [<code>data=</code>, "dict/bytes", "Form-encoded (dict) or raw body (bytes)."],
                [<code>text=</code>, "str", "Plain-text body; templated with {'{{'}vars{'}}'}."],
                [<code>headers=</code>, "dict", "Per-request headers (merged over the Target's defaults)."],
                [<code>params=</code>, "dict", "Query-string parameters."],
                [<code>auth=</code>, "dict", "Auth spec — bearer, apikey, or basic (see Variables & Secrets)."],
                [<code>timeout_ms=</code>, "int", "Per-request timeout override."],
                [<code>follow_redirects=</code>, "bool", "Follow 3xx hops (default true); each hop is recorded."],
              ]}
            />
            <H3>Single-step check</H3>
            <Code language="python">{`from src.testkit import HttpTest, TestMetadata, TYPE_HTTP


class HealthOk(HttpTest):
    metadata = TestMetadata(
        key="self.health", name="Service · health returns ok",
        type=TYPE_HTTP, target="qtp_self", tags=["smoke"],
    )

    def test(self, ctx):
        resp = ctx.http.get("/health")

        resp.should.have_status(200)
        resp.should.respond_within_ms(3000)
        resp.json.should.have_field("status").equal_to("ok")
        resp.json.should.have_field("service").equal_to("qtp")`}</Code>
            <H3>Stateful multi-step workflow</H3>
            <Paragraph>
              Group related actions into named <code>ctx.step(...)</code> blocks — they become the step timeline in run
              detail. Pass state between steps as ordinary Python variables (or via <code>ctx.set_var</code> when you want
              it templated into later URLs/headers). Override <code>cleanup</code> to undo anything you created.
            </Paragraph>
            <Code language="python">{`from src.testkit import HttpTest, TestMetadata, TYPE_HTTP

TOKEN = {"type": "bearer", "token": "{{api_token}}"}


class TargetsCrud(HttpTest):
    metadata = TestMetadata(
        key="self.targets_crud", name="Targets · create → read → delete",
        type=TYPE_HTTP, target="qtp_self", tags=["api", "multi-step"],
    )

    def test(self, ctx):
        with ctx.step("Create target"):
            resp = ctx.http.post("/api/targets", auth=TOKEN, json={
                "key": "scn_tgt", "name": "Scenario Target",
                "base_url": "http://example.com",
            })
            resp.should.have_status(201)
            ctx.set_var("target_id", resp.json.get("$.id"))   # capture the id

        with ctx.step("Read it back"):
            tid = ctx.get_var("target_id")
            resp = ctx.http.get(f"/api/targets/{tid}", auth=TOKEN)
            resp.should.have_status(200)
            resp.json.should.have_field("target.key").equal_to("scn_tgt")

    def cleanup(self, ctx):
        # Always runs — leave no test data behind.
        tid = ctx.get_var("target_id")
        if tid:
            ctx.http.delete(f"/api/targets/{tid}", auth=TOKEN)
            ctx.log("info", f"deleted scenario target {tid}")`}</Code>

            {/* ─────────────────────── PYTHON ─────────────────────── */}
            <H2 id="authoring-python" icon={<CodeOutlined />}>Authoring: Python Logic</H2>
            <Paragraph>
              When a check needs more than HTTP — a database query, a Kafka publish, an SDK call, custom business logic —
              reach for <code>PythonTest</code>. It's a blank canvas: write any Python, import any library available in the
              worker image, and record evidence explicitly with <code>ctx.assert_that(...)</code>.
            </Paragraph>
            <Code language="python">{`from src.testkit import PythonTest, TestMetadata, TYPE_PYTHON
import requests


class ExampleDomainCheck(PythonTest):
    metadata = TestMetadata(
        key="misc.example_domain", name="example.com serves the marketing page",
        type=TYPE_PYTHON, target="qtp_self", tags=["python", "http"],
    )

    def test(self, ctx):
        ctx.log("info", "requesting example.com")
        resp = requests.get("https://example.com/", timeout=10)

        # ctx.assert_that(source, operator, actual, expected, passed, message=...)
        ctx.assert_that(
            "status_code", "equals", resp.status_code, 200,
            resp.status_code == 200, message="expected HTTP 200",
        )
        ctx.assert_that(
            "body", "contains", "Example Domain", "Example Domain",
            "Example Domain" in resp.text, message="marketing copy present",
        )`}</Code>
            <Callout title="assert_that records evidence" type="info">
              <code>ctx.assert_that</code> stores an assertion (with expected vs. actual) and plots it on the timeline. Like
              fluent assertions, a failing one raises and stops the scenario. You still get <code>ctx.http</code>,{' '}
              <code>ctx.cli</code>, and <code>ctx.browser</code> inside a <code>PythonTest</code> if you want them — the base
              class only changes the <em>default</em> worker capability, not the tools available.
            </Callout>

            {/* ─────────────────────── BROWSER ─────────────────────── */}
            <H2 id="authoring-browser" icon={<DesktopOutlined />}>Authoring: Browser Tests</H2>
            <Paragraph>
              <code>PlaywrightTest</code> drives a managed Chromium session at <code>ctx.browser</code>. Beyond assertions, it
              auto-instruments the page: every network request, console message, and page error is captured, and the run
              gets a full DevTools-style waterfall — including <strong>N+1 duplicate call</strong> detection and interaction
              timing. Run these on a Playwright-enabled worker image.
            </Paragraph>
            <Code language="python">{`from src.testkit import PlaywrightTest, TestMetadata, TYPE_PLAYWRIGHT


class HomepageLoads(PlaywrightTest):
    metadata = TestMetadata(
        key="web.homepage", name="Homepage renders the hero",
        type=TYPE_PLAYWRIGHT, target="marketing_site", tags=["ui", "smoke"],
    )

    def test(self, ctx):
        result = ctx.browser.visit("/")          # relative to the Target base_url
        result.should.have_status(200)
        result.should.have_title_containing("Acme")
        result.should.have_visible("h1")
        result.should.show_text("Get started")

        # Drop into raw Playwright for anything the fluent API doesn't cover:
        page = result.page
        page.click("text=Get started")
        page.wait_for_url("**/signup")`}</Code>
            <Paragraph>
              The fluent page assertions are <code>have_status</code>, <code>have_title_containing</code>,{' '}
              <code>show_text</code>, and <code>have_visible(selector)</code>. For everything else, <code>result.page</code> is
              the live Playwright <code>Page</code>.
            </Paragraph>
            <Paragraph>
              For suites that require a specific grid or legacy WebDriver behavior, <code>SeleniumTest</code> shares the same
              lifecycle — drive the driver directly and record assertions with <code>ctx.assert_that</code>:
            </Paragraph>
            <Code language="python">{`from src.testkit import SeleniumTest, TestMetadata, TYPE_SELENIUM


class LegacyLogin(SeleniumTest):
    metadata = TestMetadata(
        key="web.legacy_login", name="Legacy login (WebDriver)",
        type=TYPE_SELENIUM, target="legacy_portal",
    )

    def test(self, ctx):
        from selenium import webdriver
        from selenium.webdriver.common.by import By

        options = webdriver.ChromeOptions()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        driver = webdriver.Chrome(options=options)
        try:
            driver.get("https://legacy.example.com/login")
            title = driver.find_element(By.TAG_NAME, "h1").text.strip()
            ctx.assert_that("title", "equals", title, "Sign in",
                            title == "Sign in", message="login page shown")
        finally:
            driver.quit()`}</Code>

            {/* ─────────────────────── CLI ─────────────────────── */}
            <H2 id="authoring-cli" icon={<ToolOutlined />}>Authoring: CLI Tools</H2>
            <Paragraph>
              <code>CliTest</code> runs a shell command or binary inside the worker and captures its exit code, stdout,
              stderr, and duration. It's the escape hatch for wrapping existing scripts or invoking specialized tools
              (<code>k6</code>, <code>newman</code>, <code>curl</code>, your own CLI).
            </Paragraph>
            <Code language="python">{`from src.testkit import CliTest, TestMetadata, TYPE_CLI


class DogFactsReachable(CliTest):
    metadata = TestMetadata(
        key="cli.dog_facts", name="Dog facts API responds",
        type=TYPE_CLI, target="qtp_self", tags=["cli"],
    )

    def test(self, ctx):
        res = ctx.cli.run("curl -s -o /dev/null -w '%{http_code}' https://dogapi.dog/api/v2/facts")

        res.should.succeed()                       # exit code 0
        res.should.output_contains("200")
        res.should.complete_within_ms(5000)`}</Code>
            <Paragraph>
              The fluent CLI assertions are <code>succeed()</code>, <code>fail()</code>, <code>have_exit_code(n)</code>,{' '}
              <code>output_contains(text)</code>, <code>output_matches(regex)</code>, <code>stderr_contains(text)</code>, and{' '}
              <code>complete_within_ms(ms)</code>. <code>ctx.cli.run</code> also accepts <code>cwd</code>, <code>env</code>,{' '}
              <code>input_text</code>, and <code>timeout_s</code>, and takes either a shell string or an argv list.
            </Paragraph>

            {/* ─────────────────────── ASSERTIONS ─────────────────────── */}
            <H2 id="assertions" icon={<SafetyOutlined />}>Assertions Reference</H2>
            <Paragraph>
              <strong>Assertions are evidence.</strong> A failure is only useful if you know exactly what was expected and
              what came back — so every QTP assertion records both. The same operator engine backs code scenarios, the
              Request Builder, and Python <code>assert_that</code>, so semantics are identical everywhere.
            </Paragraph>
            <H3>Response assertions</H3>
            <Paragraph>Off <code>response.should</code>:</Paragraph>
            <ul>
              <li><code>have_status(code)</code> · <code>have_status_in([200, 201])</code></li>
              <li><code>respond_within_ms(ms)</code></li>
              <li><code>contain_text(text)</code> · <code>not_contain_text(text)</code> · <code>match_regex(pattern)</code></li>
              <li><code>have_header(name).that_exists() / .equal_to(v) / .containing(v) / .matching(re)</code></li>
            </ul>
            <H3>JSON field assertions</H3>
            <Paragraph>
              Off <code>response.json.should.have_field(path)</code>. Paths accept dotted (<code>user.email</code>), bracket
              (<code>items[0].id</code>), and JSONPath-style (<code>$.data.token</code>) forms:
            </Paragraph>
            <ul>
              <li><code>exists()</code> · <code>not_exist()</code></li>
              <li><code>equal_to(v)</code> · <code>not_equal_to(v)</code> · <code>containing(v)</code> · <code>matching(re)</code> · <code>one_of([...])</code></li>
              <li><code>greater_than(n)</code> · <code>at_least(n)</code> · <code>less_than(n)</code> · <code>at_most(n)</code></li>
              <li><code>with_length(n)</code> · <code>with_length_at_least(n)</code> · <code>with_length_at_most(n)</code></li>
            </ul>
            <Paragraph>
              You can also read values out for use in later steps with <code>response.json.get("$.path")</code>, and check
              top-level shape with <code>response.json.should.be_an_array()</code> / <code>be_an_object()</code>.
            </Paragraph>
            <H3>The operator taxonomy</H3>
            <Paragraph>
              Fluent methods compile down to these operators. In the Request Builder and <code>assert_that</code> you name
              them directly:
            </Paragraph>
            <DataTable
              head={["Operator", "Applies to", "Semantics"]}
              rows={operatorRows.map((r) => [<code>{r[0]}</code>, r[1], r[2]])}
            />
            <H3>Putting it together</H3>
            <Code language="python">{`def test(self, ctx):
    resp = ctx.http.get("/v1/orders", params={"status": "open"})

    resp.should.have_status_in([200, 304])
    resp.should.have_header("content-type").containing("application/json")

    resp.json.should.be_an_array()
    resp.json.should.have_field("$[0].id").exists()
    resp.json.should.have_field("$[0].total").at_least(0)
    resp.json.should.have_field("$[0].status").one_of(["open", "pending"])`}</Code>

            {/* ─────────────────────── VARIABLES & SECRETS ─────────────────────── */}
            <H2 id="variables-secrets" icon={<KeyOutlined />}>Variables, Templating &amp; Secrets</H2>
            <Paragraph>
              QTP supports <code>{'{{'}token{'}}'}</code> templating inside URLs, headers, query params, and text bodies.
              Tokens resolve first against run <strong>variables</strong>, then against <strong>secrets</strong>. This is how a
              value captured in step one flows into step two, and how credentials stay out of your code and logs.
            </Paragraph>
            <Code language="python">{`def test(self, ctx):
    # 1) Capture a value and store it as a variable
    login = ctx.http.post("/auth/login", json={"user": "alice"})
    ctx.set_var("token", login.json.get("$.access_token"))

    # 2) Reference it later with {{token}} — templated into the header
    me = ctx.http.get("/me", headers={"Authorization": "Bearer {{token}}"})
    me.should.have_status(200)

    # Or read it back explicitly
    ctx.log("info", f"token starts with {ctx.get_var('token')[:6]}")`}</Code>
            <H3>Authentication helpers</H3>
            <Paragraph>
              The <code>auth=</code> argument understands three schemes and applies the right header for you. Reference a
              secret by name so the value is redacted from logs and evidence:
            </Paragraph>
            <Code language="python">{`# Bearer — token can be a literal, a {{var}}, or a secret name
ctx.http.get("/me", auth={"type": "bearer", "token": "{{api_token}}"})
ctx.http.get("/me", auth={"type": "bearer", "tokenSecretRef": "PROD_TOKEN"})

# API key header
ctx.http.get("/data", auth={"type": "apikey", "headerName": "X-API-Key", "value": "{{key}}"})

# HTTP basic
ctx.http.get("/admin", auth={"type": "basic", "username": "svc", "password": "{{pw}}"})`}</Code>
            <Callout title="Secrets are redacted" type="warn">
              Any secret value is masked (replaced with <code>***</code>) before logs and artifacts are persisted, so a
              token never lands in the run history. Prefer <code>tokenSecretRef</code> / secret-backed values over
              hard-coding credentials in a scenario file that lives in Git.
            </Callout>

            {/* ─────────────────────── STEPS & EVIDENCE ─────────────────────── */}
            <H2 id="steps-evidence" icon={<ProfileOutlined />}>Steps, Logging &amp; Evidence</H2>
            <Paragraph>
              Everything a scenario records becomes queryable evidence attached to the run. Three tools shape what you
              see in run detail:
            </Paragraph>
            <ul>
              <li><strong><code>ctx.step("name")</code></strong> — a context manager that groups actions and assertions into a labeled, timed step. Steps become the step timeline and the row list in run detail. A failure inside a step marks that step failed.</li>
              <li><strong><code>ctx.log(level, message, **context)</code></strong> — structured logging (<code>debug</code>, <code>info</code>, <code>warning</code>, <code>error</code>). Lines appear on the Logs tab and are redacted for secrets.</li>
              <li><strong>Automatic HTTP evidence</strong> — every <code>ctx.http</code> call records the full request/response payload, status, timing (DNS, TTFB, download), and a waterfall entry. No wiring required.</li>
            </ul>
            <Code language="python">{`def test(self, ctx):
    with ctx.step("Warm up"):
        ctx.log("info", "priming cache")
        ctx.http.get("/health").should.have_status(200)

    with ctx.step("Place order"):
        resp = ctx.http.post("/orders", json={"sku": "A1", "qty": 2})
        resp.should.have_status(201)
        ctx.log("info", "order created", order_id=resp.json.get("$.id"))`}</Code>
            <Paragraph>
              A run you open in the UI exposes tabs for <strong>Assertions</strong> (expected vs. actual diff),{' '}
              <strong>Response</strong> (headers + body per step), <strong>Logs</strong>, a <strong>Steps flow</strong> diagram, and
              the <strong>Waterfall</strong> — a network timeline that traces DNS, TTFB, and content download, flags{' '}
              <strong>N+1 duplicate calls</strong>, and records long interaction delays and page-visibility changes for
              browser runs.
            </Paragraph>

            {/* ─────────────────────── REQUEST BUILDER ─────────────────────── */}
            <H2 id="request-builder" icon={<ThunderboltOutlined />}>Request Builder (No-Code)</H2>
            <Paragraph>
              Not every check needs a code file. The <strong>Request Builder</strong> is a Postman-style, in-browser editor
              for multi-step HTTP scenarios: define steps, set auth, add assertions, and capture values between steps —
              all visually. Saved builder scenarios are first-class QTP scenarios; they schedule, run, and report exactly
              like code.
            </Paragraph>
            <Paragraph>
              Under the hood a builder scenario is stored as JSON, which is also what <code>POST /api/request-tests</code>
              accepts — so you can generate them programmatically:
            </Paragraph>
            <Code language="json">{`{
  "name": "Auth and fetch profile",
  "config": {
    "target": "users_api",
    "steps": [
      {
        "id": "login",
        "method": "POST",
        "url": "/api/login",
        "body": { "mode": "json", "raw": "{\\"user\\":\\"alice\\"}" },
        "captures": [
          { "name": "token", "source": "json_path", "path": "$.token" }
        ],
        "assertions": [
          { "type": "status_code", "operator": "equals", "expected": 200 }
        ]
      },
      {
        "id": "profile",
        "method": "GET",
        "url": "/api/me",
        "headers": [
          { "name": "Authorization", "value": "Bearer {{token}}" }
        ],
        "assertions": [
          { "type": "json_path", "path": "$.role", "operator": "equals", "expected": "admin" }
        ]
      }
    ]
  }
}`}</Code>
            <Paragraph>
              Note the same building blocks as code: a <code>target</code>, ordered <code>steps</code>, <code>captures</code>{' '}
              that feed <code>{'{{'}token{'}}'}</code> into later steps, and <code>assertions</code> using the operator
              taxonomy. Use <code>POST /api/request-tests/send</code> to try a config ad hoc without saving it.
            </Paragraph>

            {/* ─────────────────────── SCHEDULING ─────────────────────── */}
            <H2 id="scheduling" icon={<ScheduleOutlined />}>Scheduling</H2>
            <Paragraph>
              A schedule is the heartbeat of your quality signal: it fires a group of scenarios on an interval or cron and
              aggregates their results. Every fire produces a <code>ScheduleRun</code> that rolls up the individual runs
              into one pass/fail number, so you can watch a suite's health over time.
            </Paragraph>
            <DataTable
              head={["Pattern", "Cadence", "Good for"]}
              rows={[
                ["Continuous monitoring", "every 1–5 min (interval)", "Critical P0 flows against production — login, checkout, search."],
                ["Post-deploy gate", "on demand (from CI)", "A full regression suite triggered after a successful deploy."],
                ["Nightly regression", "cron 0 2 * * *", "Long end-to-end suites that are too slow to run per-commit."],
                ["Hourly canary", "every 1h", "Broad, cheap coverage to catch slow drift between deploys."],
              ]}
            />
            <Paragraph>
              Schedules select scenarios by target and tags (for example, "everything tagged <code>smoke</code> on{' '}
              <code>production_api</code>"), so tagging discipline pays off: tag scenarios by criticality (<code>p0</code>,{' '}
              <code>p1</code>) and by suite (<code>smoke</code>, <code>regression</code>) and your schedules practically write
              themselves.
            </Paragraph>

            {/* ─────────────────────── EXECUTION ─────────────────────── */}
            <H2 id="execution" icon={<DashboardOutlined />}>Execution &amp; Results</H2>
            <Paragraph>
              A run moves through a small state machine. Understanding it explains what you see on the Runs page and how
              CI should poll.
            </Paragraph>
            <DataTable
              head={["Status", "Kind", "Meaning"]}
              rows={[
                [<Tag>queued</Tag>, "active", "Requested and published to the queue; waiting for a worker."],
                [<Tag color="processing">running</Tag>, "active", "A worker claimed it and is executing test(ctx)."],
                [<Tag color="green">passed</Tag>, "terminal", "Every assertion passed."],
                [<Tag color="red">failed</Tag>, "terminal", "An assertion failed (the app behaved wrongly)."],
                [<Tag color="orange">error</Tag>, "terminal", "The scenario raised unexpectedly (usually a test/infra bug)."],
                [<Tag color="gold">timeout</Tag>, "terminal", "Exceeded its time budget."],
                [<Tag>canceled</Tag>, "terminal", "Cancellation was requested before it finished."],
              ]}
            />
            <Paragraph style={{ marginTop: '1.5em' }}>
              The distinction between <code>failed</code> and <code>error</code> is deliberate and important:{' '}
              <strong>failed</strong> means an assertion did not hold — the system under test is (probably) wrong;{' '}
              <strong>error</strong> means the scenario itself threw — usually the test or the environment is wrong. Track
              them separately and your pass-rate stays meaningful.
            </Paragraph>
            <Paragraph>
              The <strong>Cleanup</strong> column on the Runs page reports whether a scenario's <code>cleanup</code> hook
              succeeded independently of the run verdict, so a leaked resource is visible without flipping a passing run to
              failed. You can re-run any run from its revision, cancel an active one, and bulk re-queue stuck or failed
              runs from the Runs page or the API.
            </Paragraph>

            {/* ─────────────────────── DEFECT TRIAGE ─────────────────────── */}
            <H2 id="defect-triage" icon={<BugOutlined />}>Defect Triage &amp; Failure Analysis</H2>
            <Paragraph>
              A red test isn't automatically a bug — it might be a flaky scenario or an environment blip. QTP lets you
              classify each failure so your metrics separate <em>application health</em> from <em>test reliability</em>.
              Assign a defect type from run detail (or via <code>PUT /api/runs/&#123;id&#125;/defect</code>):
            </Paragraph>
            <DataTable
              head={["Defect type", "Use when"]}
              rows={[
                [<Tag color="red">product_bug</Tag>, "The application is genuinely wrong — a real defect to file."],
                [<Tag color="orange">automation_bug</Tag>, "The scenario is wrong — a bad assertion, timing, or selector."],
                [<Tag color="gold">system_issue</Tag>, "Infra/environment — a flaky network, a down dependency, a bad deploy."],
                [<Tag color="blue">to_investigate</Tag>, "Not yet triaged; needs a human look."],
                [<Tag>no_defect</Tag>, "A known/expected failure that isn't actionable."],
              ]}
            />
            <Paragraph style={{ marginTop: '1.5em' }}>
              The <strong>Overview</strong> and <strong>Failures</strong> dashboards then show a defect-type split and group
              recurring failures by <strong>signature</strong> (a hash of the error), so a single flaky root cause shows up
              once with an occurrence count instead of as fifty separate red rows. Every stat tile on the Overview links
              straight into a pre-filtered Runs view.
            </Paragraph>

            {/* ─────────────────────── CI ─────────────────────── */}
            <H2 id="ci" icon={<DeploymentUnitOutlined />}>CI/CD Integration</H2>
            <Paragraph>
              The highest-value use of QTP is gating deployments. Your CI job shouldn't run the tests itself — it should
              <strong> trigger QTP, poll for the result, and fail the pipeline</strong> if QTP reports anything but a pass.
              Authenticate every request with a Bearer token in the <code>Authorization</code> header.
            </Paragraph>
            <H3>GitHub Actions</H3>
            <Code language="yaml">{`name: QTP E2E Tests
on: [deployment_status]

jobs:
  qtp:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - name: Trigger and poll a QTP scenario
        env:
          QTP_URL: \${{ secrets.QTP_URL }}
          QTP_TOKEN: \${{ secrets.QTP_TOKEN }}
          SCENARIO_ID: "checkout.e2e"
        run: |
          RUN_ID=$(curl -sf -X POST "$QTP_URL/api/scenarios/$SCENARIO_ID/run" \\
            -H "Authorization: Bearer $QTP_TOKEN" -H "Content-Type: application/json" \\
            -d '{"tags": ["github-actions"]}' | jq -r '.id')
          echo "run: $RUN_ID"

          STATUS="queued"
          while [ "$STATUS" = "queued" ] || [ "$STATUS" = "running" ]; do
            sleep 5
            STATUS=$(curl -sf "$QTP_URL/api/runs/$RUN_ID" \\
              -H "Authorization: Bearer $QTP_TOKEN" | jq -r '.status')
          done

          echo "final: $STATUS"
          [ "$STATUS" = "passed" ] || exit 1`}</Code>
            <H3>GitLab CI</H3>
            <Code language="yaml">{`qtp_e2e:
  stage: test
  image: alpine:latest
  before_script: [apk add --no-cache curl jq]
  variables:
    SCENARIO_ID: "checkout.e2e"
  script:
    - |
      RUN_ID=$(curl -sf -X POST "$QTP_URL/api/scenarios/$SCENARIO_ID/run" \\
        -H "Authorization: Bearer $QTP_TOKEN" -H "Content-Type: application/json" \\
        -d '{"tags": ["gitlab-ci"]}' | jq -r '.id')
      STATUS="queued"
      while [ "$STATUS" = "queued" ] || [ "$STATUS" = "running" ]; do
        sleep 5
        STATUS=$(curl -sf "$QTP_URL/api/runs/$RUN_ID" \\
          -H "Authorization: Bearer $QTP_TOKEN" | jq -r '.status')
      done
      [ "$STATUS" = "passed" ] || exit 1`}</Code>
            <Callout title="Discover on push" type="info">
              Add a step that calls <code>POST /api/scenarios/discover</code> right after your app deploys, so new or changed
              scenarios are registered before the gate runs them. To run a whole target's suite synchronously, use{' '}
              <code>POST /api/targets/&#123;id&#125;/run-all?sync=true</code> and inspect the returned per-scenario results.
            </Callout>

            {/* ─────────────────────── API ─────────────────────── */}
            <H2 id="api" icon={<ApiOutlined />}>API Reference</H2>
            <Paragraph>
              Everything the UI does is REST under the hood. Authenticate with a Bearer token. Base path is your QTP host
              plus <code>/api</code> (for the bundled stack, <code>http://localhost:5100/qtp/api</code>). List endpoints
              accept <code>page</code>, <code>page_size</code>, <code>sort</code>, <code>order</code>, and per-field filters —
              the same parameters the tables use.
            </Paragraph>
            <ApiTable />

            {/* ─────────────────────── PATTERNS ─────────────────────── */}
            <H2 id="patterns" icon={<RocketOutlined />}>Patterns &amp; Best Practices</H2>
            <ul>
              <li><strong>One scenario, one behavior.</strong> Keep each scenario focused on a single observable behavior. Small scenarios pinpoint failures; giant ones bury them.</li>
              <li><strong>Assert the payload, not just the status.</strong> A 200 with the wrong body still ships a bug. Check the fields that matter with <code>have_field(...).equal_to(...)</code>.</li>
              <li><strong>Always clean up what you create.</strong> If <code>test</code> POSTs, <code>cleanup</code> should DELETE. It runs even on failure, so runs stay repeatable and don't leak state.</li>
              <li><strong>Never hard-code URLs or secrets.</strong> Address a Target key and inject the environment; reference secrets by name so they're redacted.</li>
              <li><strong>Use steps to tell a story.</strong> Named <code>ctx.step</code> blocks turn a run into a readable timeline and localize failures to a phase.</li>
              <li><strong>Tag for scheduling and triage.</strong> Consistent tags (<code>smoke</code>, <code>p0</code>, <code>regression</code>) let schedules and dashboards select the right slice with no code changes.</li>
              <li><strong>Keep scenarios deterministic.</strong> Avoid depending on wall-clock time, external mutable data you don't control, or the ordering of other scenarios.</li>
              <li><strong>Prefer relative timeouts.</strong> Assert <code>respond_within_ms</code> generously enough to avoid false alarms, but tight enough to catch real regressions.</li>
            </ul>

            {/* ─────────────────────── EXTEND ─────────────────────── */}
            <H2 id="extend" icon={<BuildOutlined />}>Extending QTP</H2>
            <Paragraph>
              For bespoke protocols (gRPC, AMQP, a proprietary transport) or shared testing utilities, you can add a new
              scenario type or a reusable base class. The lifecycle and evidence model are inherited for free.
            </Paragraph>
            <ol className="qtp-docs-steps" style={{ paddingLeft: '20px', margin: '20px 0' }}>
              <li style={{ marginBottom: '10px' }}>Define a new type constant (e.g. <code>TYPE_GRPC</code>) and register it in the supported types.</li>
              <li style={{ marginBottom: '10px' }}>Create a base class (<code>GrpcTest(Scenario)</code>) that sets its <code>default_type</code> and, if useful, exposes a client via a context property.</li>
              <li style={{ marginBottom: '10px' }}>Record evidence with <code>ctx.assert_that(...)</code> so gRPC checks show up in run detail exactly like HTTP ones.</li>
              <li style={{ marginBottom: '10px' }}>Ensure the worker image ships the client libraries, and that a worker advertises the matching capability.</li>
            </ol>
            <Paragraph>
              Simpler still: put shared helpers in an underscore-prefixed module (<code>_helpers.py</code>) next to your
              scenarios — discovery skips it, and your scenarios import from it normally.
            </Paragraph>

            {/* ─────────────────────── TROUBLESHOOTING ─────────────────────── */}
            <H2 id="troubleshooting" icon={<QuestionCircleOutlined />}>Troubleshooting &amp; FAQ</H2>
            <H3>My scenario doesn't appear after discovery</H3>
            <ul style={{ marginBottom: '16px' }}>
              <li>Confirm the file is under <code>backend/scenarios/automation/&lt;target&gt;/</code> and its name doesn't start with an underscore.</li>
              <li>The class must subclass a QTP base (<code>HttpTest</code>, <code>PythonTest</code>, …) and define a <code>metadata</code> attribute.</li>
              <li><code>metadata.key</code> must be globally unique — a duplicate fails the whole discovery pass. Check the discovery response for the error.</li>
              <li>An import error or syntax error in the module will surface in the <code>/discover</code> response; fix it and re-discover.</li>
            </ul>
            <H3>A run is stuck in "queued"</H3>
            <ul style={{ marginBottom: '16px' }}>
              <li>No worker can serve it. Open <strong>Workers</strong> and check heartbeats are fresh.</li>
              <li>The scenario needs a capability (e.g. <code>playwright</code>) that no active worker advertises.</li>
              <li>The queue is backed up — watch the Running/Queued counters on the Runs page.</li>
            </ul>
            <H3>My HTTP requests time out or are blocked</H3>
            <ul style={{ marginBottom: '16px' }}>
              <li>The worker must have network egress to the Target's URL.</li>
              <li>Requests to internal/loopback ranges (<code>127.0.0.1</code>, <code>10.x</code>) may be blocked by SSRF protection unless explicitly allowed.</li>
              <li>Raise <code>timeout_ms</code> on the specific call if the endpoint is legitimately slow.</li>
            </ul>
            <H3>Why is my run "error" and not "failed"?</H3>
            <Paragraph style={{ marginBottom: '16px' }}>
              <code>failed</code> is a failed assertion; <code>error</code> is an unhandled exception in the scenario — a bad
              path, a <code>None</code> where you expected data, a missing capture. Open the <strong>Logs</strong> tab; the
              exception message and the last log lines pinpoint it.
            </Paragraph>
            <Callout title="Still stuck?" type="info">
              Open the run's <strong>Logs</strong> and <strong>Response</strong> tabs first — between the redacted request,
              the raw response body, and your <code>ctx.log</code> lines, most failures explain themselves. The{' '}
              <a href="#api">API reference</a> mirrors everything the UI can do if you'd rather script your diagnosis.
            </Callout>
          </article>
        </Col>
      </Row>
    </div>
  );
}
