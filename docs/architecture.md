# Quality Testing Platform Architecture

_Last updated: 2026-07-07._

Quality Testing Platform, short name QTP, is an automation testing platform and
test framework for running, scheduling, observing, and analyzing automated tests
against **any target application**. It combines two ideas that today live in two
separate tools:

- **Testkube-style execution** — a central control plane that owns test
  definitions, schedules, a durable execution queue, and workers that run tests
  (HTTP, browser, CLI/containerized tools, and custom Python) on demand or on a
  recurrence.
- **ReportPortal-style reporting** — a centralized store of every run with
  history, dashboards, analytics, failure grouping, and human/assisted defect
  triage, so results from many tests and many target apps are analyzed in one
  place.

QTP supports two ways of authoring tests, both of which point at an
application-under-test by URL:

1. **Code-based automation tests** written with the QTP framework and stored in
   the repository. The target URL is resolved from the test's environment/target
   configuration (never hard-coded).
2. **UI-created request tests** built in a Postman-like builder, where the user
   types the URL directly (with variable templating), configures the request,
   and defines assertions on the **response body and metadata — not only the
   status code**. These can be sent on demand or scheduled to recur.

In addition to test management and reports, QTP boasts a high-performance **Waterfall view** and **Rich Telemetry Engine** that captures advanced execution signals natively from Playwright and Selenium CDP hooks, including DNS lookups, N+1 Duplicate API detection, User Interaction Delays, and Source-Mapped Error Traces.

QTP is built as a Python/Flask/QF backend with PostgreSQL persistence and a
React/Vite/Ant Design frontend.

The platform has two equal responsibilities:

1. Provide a maintainable framework for adding new automation tests against any
   app, with a common base class, consistent result model, logging, artifacts,
   retries, environments, targets, and schedules.
2. Provide an operational UI where users can create request tests, run tests,
   schedule recurrence, inspect results, compare runs, triage failures, and
   understand trends across every target application.

## 1. System Topology

```text
Browser
  React + Vite + Ant Design
      |
      | JSON API, JWT bearer token, polling + optional SSE run stream
      v
QTP API process
  Python + Flask + QF FrameworkApp + Flask-RESTX dynamic endpoints
      |
      +-- PostgreSQL: definitions, targets, schedules, queue, runs, logs, metrics
      +-- Object storage: screenshots, videos, traces, response bodies
      +-- QTP worker process: executes HTTP, Playwright, Selenium, CLI/containers, scripts
      +-- Scheduler process: creates due run intents from recurrence rules
      +-- Result ingestion API: import externally-produced results (JUnit/JSON)
      +-- Optional Redis: cache, live run streams, short-lived coordination
      +-- Optional Kafka via QF ETL: high-volume execution event transport
      +-- OpenTelemetry collector: traces and service metrics
      |
      v
  Target applications under test (any HTTP/browser app, addressed by URL)
```

The minimum deployable system is:

- one API process;
- one worker process;
- one scheduler process;
- PostgreSQL.

Redis, Kafka, object storage, and OpenTelemetry are recommended production
services, but QTP should still run locally with PostgreSQL and filesystem
artifact storage.

The **target applications** are external to QTP. QTP never assumes it tests
itself; every test names the app it exercises by URL, resolved from a target or
environment (code tests) or typed in the request builder (UI tests). This is
what makes QTP a general testing platform rather than a suite for one app.

## 2. Positioning: Testkube And ReportPortal

QTP deliberately merges the two capabilities into one modulith so operators do
not run and correlate two systems.

| Capability | Testkube analog | ReportPortal analog | QTP |
| --- | --- | --- | --- |
| Test orchestration and scheduling | Yes | No | Yes |
| Pluggable executors (HTTP, browser, CLI/container tools) | Yes | No | Yes, via adapters incl. a CLI/container executor |
| On-demand + scheduled + triggered runs | Yes | No | Yes |
| Centralized result store with history | Partial | Yes | Yes |
| Dashboards, widgets, analytics | Partial | Yes | Yes |
| Failure grouping / auto-analysis | No | Yes (ML) | Yes (deterministic failure signatures + assisted triage) |
| Defect-type triage taxonomy | No | Yes | Yes |
| Ingest results from tests QTP did not run | No | Yes (agents/API) | Yes, via result ingestion API |
| Postman-like request builder with body assertions | No | No | Yes |

The two design implications that follow from this positioning:

- Execution must be **extensible to arbitrary tools** (Testkube runs newman,
  k6, cypress, etc. as containers). QTP includes a first-class CLI/container
  executor so it does not have to reimplement every framework.
- Reporting must be **fed from more than QTP's own workers** (ReportPortal's core
  value is centralization). QTP therefore accepts imported results in addition
  to results it produces itself.

## 3. Runtime Stack

Backend:

- Python 3.12.
- Flask 3 with Flask-RESTX through the QF Framework.
- QF Framework local wheel `dist/qf-1.0.2-py3-none-any.whl`.
- SQLAlchemy 2, Alembic, psycopg.
- PostgreSQL 15+.
- Pydantic 2 for request validation and DTOs.
- Playwright Python, Selenium, and requests.
- `flask-jwt-extended` and `flask-bcrypt` for authentication (already transitive
  dependencies of the QF wheel; QTP wires them, QF does not).
- APScheduler or an internal PostgreSQL polling scheduler.
- OpenTelemetry for traces.

Frontend:

- React 19.
- TypeScript.
- Vite.
- Ant Design 6 and `@ant-design/icons`.
- TanStack Query for server state.
- Zustand for local UI/session state.
- React Router.
- ECharts for charts.
- `react-grid-layout` for customizable dashboards.

> Confirm at scaffold time that the chosen Ant Design 6, `react-grid-layout`,
> and ECharts releases support React 19 (StrictMode double-invoke in
> particular). Pin versions once verified.

## 4. QF Integration (Concrete Constraints)

The local qf wheel exposes the import package `framework`. Reading the wheel
source is mandatory before wiring `main.py`, because several defaults will break
a naive integration. The following are load-bearing facts, not stylistic
preferences:

1. **A top-level `config.py` with a `Config` class is required.**
   `framework.api.server.create_app` calls `app.config.from_object('config.Config')`
   and `FrameworkApp.start_etl` calls `from config import Config`. Config must be
   importable as the top-level module `config` (project root on `sys.path`), not
   `src/config.py`. Put deployment config in `config.py` at the repo root; QTP's
   own richer settings may live in `src/config.py` and be referenced from it.

2. **`enable_etl` defaults to `True` and will raise without Kafka.**
   `FrameworkApp.run()` calls `start_etl()`, which raises `RuntimeError` when
   `worker_modules`/`kafka_bootstrap_servers`/`consumer_name` are missing.
   `main.py` MUST construct `FrameworkSettings(enable_etl=False, ...)` for the
   PostgreSQL-first design. Kafka is opt-in only.

3. **`FrameworkApp.run()` does not bind an HTTP server.** It builds the Flask
   app and registers endpoints, then returns handles; `api_host`/`api_port` are
   not used by the runner. `main.py` must serve the returned app explicitly
   (Flask dev server for local, gunicorn/uwsgi in production). Do not assume
   `run()` blocks and serves.

4. **QF provides no authentication.** `create_app` documents that the auth
   module was removed and security is "the responsibility of the deployment
   environment." QTP owns auth end to end, but the building blocks
   (`flask-jwt-extended`, `flask-bcrypt`, `flask-talisman`, `flask-cors`) ship as
   QF dependencies and can be wired via the `FrameworkSettings.init_app` hook,
   which receives the Flask app.

5. **Dynamic endpoint handler signature.** Endpoints declared in
   `maps/endpoint.json` dispatch through `framework.api.dynamic`, which calls the
   handler as:

   ```python
   def handler(app, operation, request, **kwargs):
       return {"ok": True}, 200
   ```

   `app` is the Flask app, `operation` is the `operation_name` string (handlers
   may branch on it), `request` is the Flask request, and path parameters arrive
   as keyword arguments. Handlers stay thin: parse, open a DB session, call a
   service, serialize a response.

6. **`maps/endpoint.json` has a required shape.** It is not free-form. It
   contains `namespaces` (list of `{name, description}`), `models` (dict of
   Flask-RESTX field definitions), and `endpoints`, where each endpoint has
   `namespace`, `operation_name`, `model_name`, `request_method` (a **list**),
   `api_url`, and `exec_method` (`{module_name, method_name}`). For
   `POST/PUT/UPDATE/DELETE` with a non-null model, QF applies
   `expect(model, validate=True)`; give `DELETE` endpoints a null model so QF
   does not demand a request body.

QF's ETL/Kafka worker support can be used later for large-scale execution
events, but the first version uses PostgreSQL as the source of truth for run
queue state. This avoids making Kafka mandatory for local development and keeps
recurrence, run locking, retries, and audit history transactionally visible.

## 5. Backend Module Boundaries

QTP is a modulith: one repository and one deployable backend image with explicit
module boundaries.

```text
config.py                 # top-level Config class required by QF
src/
  config.py               # richer application settings, referenced by /config.py
  core/
    db.py
    errors.py
    correlation.py
    pagination.py
    clock.py
    object_storage.py
    secrets.py
    net_guard.py          # SSRF resolution/pinning/allowlist checks
    telemetry.py
  iam/
    models.py             # users, api_tokens, user_project_roles
    principal.py
    decorators.py
    rbac.py
    auth.py               # JWT / API-token verification wired via init_app
    service.py
  testkit/
    base.py
    context.py            # exposes target resolution + secrets + logger
    result.py
    registry.py
    assertions.py
    adapters/
      http.py
      playwright.py
      selenium.py
      cli.py              # CLI/container executor (Testkube-style)
      python_script.py
  catalog/
    models.py             # targets, test_definitions, revisions, suites
    schemas.py
    service.py
    request_test_service.py
    serializers.py
  execution/
    models.py
    queue.py
    runner.py
    lifecycle.py
    logs.py
    artifacts.py
    failure_classifier.py
    defect_triage.py      # defect-type suggestion from failure signatures
    service.py
  ingestion/
    models.py             # result_imports
    parsers.py            # JUnit XML, generic JSON
    service.py
  scheduling/
    models.py
    recurrence.py
    scheduler.py
    service.py
  reporting/
    queries.py
    materialized_views.py
    service.py
  audit/
    models.py
    events.py
    service.py
  api/
    health.py
    auth.py
    tests.py
    request_tests.py
    targets.py
    runs.py
    schedules.py
    suites.py
    dashboards.py
    defects.py
    imports.py
    workers.py
    audit.py
  workers/
    execution_worker.py
    scheduler_worker.py
```

Dependency direction:

- `core` imports no application domain modules.
- `iam` depends on `core`.
- `testkit` is framework code and depends only on `core` primitives.
- `catalog`, `execution`, `scheduling`, `ingestion`, `reporting`, and `audit`
  depend on `core`, `iam`, and `testkit` contracts.
- `api` is the composition layer and may call service modules.
- `workers` are process entrypoints and may call `execution` and `scheduling`.

This gives QTP clean boundaries without splitting prematurely into
microservices.

## 6. Domain Model

The domain uses these terms consistently:

| Term | Meaning |
| --- | --- |
| Project | Logical workspace for tests, targets, environments, schedules, dashboards, and RBAC. |
| User | An authenticated principal with project-scoped roles. |
| Environment | Named runtime context such as dev, qa, staging, or prod, holding variables and secret references. |
| Target | A named application-under-test: base URL plus optional health URL and default auth, scoped to a project (and optionally an environment). This is how QTP tests any app. |
| Test Definition | Stable identity for a test. It has a key, name, type, owner, tags, and current revision. |
| Test Revision | Immutable executable version of a test definition. It stores code reference or UI request config. |
| Test Suite | Ordered group of tests with optional parallelism and fail-fast behavior. |
| Run | One execution of a test revision or suite (executed by a worker, or imported). |
| Attempt | One try inside a run. Retries create additional attempts. |
| Step | A logical action inside a run, such as "login", "GET /health", or "assert status 200". |
| Assertion | A declared check against the response (status, body, headers, timing). |
| Artifact | A file produced by a run: screenshot, video, Playwright trace, response body, HAR, or log bundle. |
| Schedule | Recurrence policy that creates runs at due times. |
| Worker | Process that claims queued runs and executes them, advertising capabilities. |
| Failure Category | The mechanical symptom of a failure (assertion, timeout, network, etc.). |
| Failure Signature | Normalized hash for grouping equivalent failures across runs. |
| Defect Type | The triage classification of a failure (product bug, automation bug, system issue, to investigate, no defect). |

## 7. Targets And Environments (Testing Any App)

QTP tests arbitrary applications. The URL of the app-under-test is never
hard-coded in test logic. It is resolved one of two ways:

- **Code-based tests** obtain the target from `TestContext`. A test declares
  which logical target it needs (for example `api` or `web`), and the context
  resolves the concrete base URL from the selected `Target`/environment at run
  time. This lets the same test run against dev, staging, or prod by changing the
  environment, and keeps old revisions reproducible in structure even as targets
  move.
- **UI request tests** carry the URL directly in their config, typically using
  `{{base_url}}` or a named target reference plus templated path and variables.
  The request builder lets the user pick a target/environment or type an
  absolute URL.

A `Target` record holds:

- `key` and `name`;
- `base_url` (required);
- optional `health_url` for readiness widgets;
- optional default auth reference (secret ref, never a raw secret);
- optional environment binding, so the same target key resolves to different
  URLs per environment;
- tags for grouping in dashboards ("which app has the worst failure rate").

Targets are a first-class analytics dimension: dashboards can slice runs and
failures by target so operators see health per application, not just per test.

## 8. Test Framework Design

QTP tests use a base class that abstracts execution details while preserving
framework-specific power for HTTP, browser, and CLI tooling.

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class TestMetadata:
    key: str
    name: str
    type: str
    tags: list[str]
    owner: str | None = None


class BaseAutomationTest(ABC):
    metadata: TestMetadata

    def validate_config(self, config: dict[str, Any]) -> None:
        return None

    def setup(self, context: "TestContext") -> None:
        return None

    @abstractmethod
    def execute(self, context: "TestContext") -> "TestResult":
        raise NotImplementedError

    def cleanup(self, context: "TestContext") -> None:
        # Optional. Undo data the test created (e.g. DELETE what a POST created).
        # Runs after execute() on BOTH success and failure, before teardown().
        # A failure here is logged but never changes the test's pass/fail status.
        return None

    def teardown(self, context: "TestContext") -> None:
        return None
```

The lifecycle the runner guarantees is `validate_config -> setup -> execute ->
cleanup -> teardown`, where `cleanup` and `teardown` always run even when
`execute` raised. `cleanup` is for reverting side effects on the
app-under-test (so mutating tests don't leak state between runs); `teardown` is
for releasing resources the test held (sessions, browsers, drivers). GET-only
tests usually implement neither.

`TestContext` exposes the target, variables, secrets, logger, artifact writer,
correlation id, and cancellation token:

```python
class TestContext:
    def target(self, key: str = "default") -> "ResolvedTarget": ...   # base_url, headers, auth
    def var(self, name: str) -> str: ...
    def secret(self, ref: str) -> str: ...                            # resolved at run time, redacted in logs
    def logger(self) -> "RunLogger": ...
    def artifacts(self) -> "ArtifactWriter": ...
    def should_cancel(self) -> bool: ...                              # cooperative cancellation
```

Specialized bases narrow the integration surface:

- `BaseHttpRequestTest` wraps a `requests.Session`, request templating,
  redirects, TLS settings, response capture, and assertions. It resolves its
  base URL from `context.target(...)`.
- `BasePlaywrightTest` owns browser, context, page lifecycle, screenshots,
  videos, traces, and network logs.
- `BaseSeleniumTest` owns WebDriver lifecycle and optional remote grid config.
- `BaseCliTest` (the Testkube-style executor) runs an arbitrary command or
  container image against the target, captures stdout/stderr and exit code, and
  parses a results file (JUnit XML or JSON) into steps and assertions. This lets
  QTP run existing tools such as newman, k6, or cypress without reimplementing
  them.
- `BasePythonScriptTest` supports custom checks that do not fit the categories
  above.

Code-based automation tests live under the repository `tests/automations/`
directory:

```text
tests/
  automations/
    api/
      test_healthcheck.py
      test_authentication.py
    browser/
      test_login_flow.py
      test_checkout_flow.py
    selenium/
      test_legacy_portal.py
    cli/
      test_k6_smoke.py
  unit/
  integration/
  e2e/
```

Platform tests for QTP itself use `tests/unit`, `tests/integration`, and
`tests/e2e`. Automation tests managed by QTP live below `tests/automations`.

The registry discovers test classes by importing configured modules and
validating that each class:

- subclasses `BaseAutomationTest`;
- has a globally unique `metadata.key`;
- declares a supported `metadata.type`;
- can validate its default configuration.

Discovery writes or updates `test_definitions` and `test_revisions` without
deleting historical revisions. This lets old run results stay reproducible.

## 9. UI-Created Request Tests

QTP includes an on-demand request builder that behaves like a focused Postman
workflow, and — critically — asserts on the **response output**, not only the
status code:

- method, URI, query parameters, headers, cookies, and body;
- target/environment selection or an absolute URL;
- auth helpers for bearer token, basic auth, API key, and custom header;
- JSON, form, text, binary, and GraphQL body modes;
- environment variables and secret references;
- request timeout, retry policy, redirect policy, and TLS verification;
- pre-request script and post-response assertions on body, headers, and timing;
- recurrence schedule;
- immediate "Send" run without saving;
- "Save as Test" to create a managed `http_request` test definition.

Request test config is stored as JSONB on `test_revisions`. Frequently queried
fields such as method, host, path, and expected status are copied to a companion
`request_test_specs` table (written in the same transaction as the revision) so
dashboards and filters do not depend on expensive JSONB scans.

Example config:

```json
{
  "target": "orders_api",
  "method": "POST",
  "url": "{{base_url}}/api/orders",
  "query": [{"name": "source", "value": "qtp", "enabled": true}],
  "headers": [{"name": "Content-Type", "value": "application/json", "enabled": true}],
  "body": {"mode": "json", "raw": "{\"customerId\":\"{{customer_id}}\"}"},
  "auth": {"type": "bearer", "tokenSecretRef": "staging_api_token"},
  "assertions": [
    {"type": "status_code", "operator": "equals", "expected": 201},
    {"type": "json_path", "path": "$.id", "operator": "exists"},
    {"type": "json_path", "path": "$.status", "operator": "equals", "expected": "created"},
    {"type": "json_path", "path": "$.items", "operator": "length_gte", "expected": 1},
    {"type": "response_time_ms", "operator": "lte", "expected": 800}
  ],
  "timeoutMs": 30000,
  "followRedirects": true,
  "tlsVerify": true
}
```

## 10. Assertion Model

Assertions are the heart of "check the output, not just the status code," so the
operator taxonomy is a first-class, versioned contract shared by the HTTP
adapter, the request builder, and the CLI executor's parsed results.

Assertion sources:

- `status_code` — the numeric HTTP status.
- `header` — a named response header value.
- `json_path` — a value extracted by JSONPath from the response body.
- `body_text` — the raw response body as text.
- `json_schema` — validate the whole body against a JSON Schema.
- `response_time_ms` — total response duration.

Operators:

- `equals`, `not_equals`;
- `contains`, `not_contains`;
- `matches` (regex), `not_matches`;
- `exists`, `not_exists`;
- `gt`, `gte`, `lt`, `lte`;
- `length_eq`, `length_gte`, `length_lte`;
- `in`, `not_in`.

Each evaluated assertion produces an `AssertionResult` with the source, operator,
expected value, actual value, and pass/fail, which is persisted and shown in run
detail. A run `passed` only when every enabled assertion passed; a single failed
assertion yields `failed` with category `assertion_failed` (or a more specific
category such as `http_status_mismatch` or `json_assertion_failed`).

## 11. Execution Lifecycle

Every run moves through a strict lifecycle:

```text
queued -> claimed -> preparing -> running -> passed
                                    |
                                    +-> failed
                                    +-> error
                                    +-> timeout
                                    +-> canceled
                                    +-> skipped
```

Status meanings:

- `passed`: all assertions and steps succeeded.
- `failed`: the system worked, but a test assertion failed.
- `error`: infrastructure, script, setup, or unexpected exception failure.
- `timeout`: test exceeded its configured timeout.
- `canceled`: user or platform canceled the run.
- `skipped`: suite policy skipped the test.

Imported runs (see section 14) are created directly in a terminal status and do
not pass through `queued`/`claimed`.

Run flow:

1. User, schedule, API, suite, or code discovery creates a run request.
2. QTP inserts `run_queue` and `test_runs` rows in one transaction.
3. A worker claims due queue rows with `FOR UPDATE SKIP LOCKED`, respecting
   worker capability (see section 21).
4. The worker loads the immutable test revision, the resolved target, and the
   environment.
5. The runner builds a `TestContext` with variables, secrets, logger, artifact
   writer, correlation id, and cancellation token.
6. The adapter executes the test with timeout and retry policy.
7. Logs, steps, artifacts, failure classification, defect-type suggestion,
   metrics, and final status are persisted.
8. Dashboards update from normal queries, materialized views, or aggregate
   tables.

Workers execute one test in an isolated subprocess by default. Browser and
CLI/container tests can move to short-lived containers for stronger isolation.

### Cancellation

`POST /api/runs/{id}/cancel` sets a cancellation flag on the run. For a
**queued** run, the worker never claims it. For a **running** run, cancellation
is cooperative and enforced in two layers: the worker's supervising process
polls the flag and (a) signals the executing subprocess to stop, and (b) if the
subprocess does not exit within a grace period, terminates it and marks the run
`canceled`. `TestContext.should_cancel()` lets long code-based tests check
cooperatively between steps. After cancellation is observed, no new steps or
artifacts are persisted for that run.

## 12. Scheduling And Recurrence

Schedules support:

- run once at a specific timestamp;
- fixed interval, such as every 5 minutes;
- cron expression with timezone;
- business-hour windows;
- jitter to avoid load spikes;
- max concurrent runs per test and per project;
- pause/resume;
- backfill policy after downtime.

The scheduler process claims due schedules with row locks, creates run intents,
computes `next_run_at`, and commits atomically. It never runs tests itself. The
worker process owns execution.

Recommended recurrence fields:

- `recurrence_type`: `once`, `interval`, or `cron`;
- `timezone`: IANA timezone such as `Europe/Bucharest`;
- `cron_expression`;
- `interval_seconds`;
- `start_at`, `end_at`;
- `next_run_at`;
- `last_enqueued_at`;
- `max_concurrent_runs`;
- `misfire_policy`: `skip`, `enqueue_once`, or `catch_up_limited`;
- `jitter_seconds`.

## 13. Suites

A suite is an ordered group of tests with optional parallelism and fail-fast
behavior, producing a `suite_run` that aggregates the child `test_runs`. Suites
are the QTP analog of a ReportPortal "launch": a single reportable unit that
groups many results. Suite behavior:

- ordered execution by default, with an optional parallelism degree;
- `fail_fast` to stop remaining items after the first failure;
- per-item environment/target overrides;
- suite-level status derived from child statuses (any error/fail propagates by
  policy);
- suite-level artifacts and a combined timeline in run detail.

## 14. Result Ingestion

To match ReportPortal's centralization, QTP accepts results produced outside its
own workers — for example a CI pipeline that already ran pytest, JUnit, or a k6
job. Ingested results become first-class runs so they appear in history,
dashboards, failure grouping, and triage alongside QTP-executed runs.

Ingestion model:

- `POST /api/imports` accepts a payload describing a launch: project, optional
  suite/target/environment, trigger `imported`, and either a generic JSON result
  document or an attached JUnit XML.
- `ingestion/parsers.py` normalizes the payload into `suite_runs`, `test_runs`,
  steps, and assertions, mapping external pass/fail into QTP statuses and
  categories.
- Definitions are matched by a stable external key so history accumulates across
  imports; unknown tests create lightweight `imported`-type definitions.
- Imported runs carry `source = imported` and are excluded from worker/queue
  metrics but included in pass-rate, history, and defect analytics.

Ingestion is optional for a first pilot but the schema and status model reserve
space for it so it is not a later rewrite.

## 15. PostgreSQL Data Model

Use PostgreSQL as the source of truth. Prefer normalized relational tables for
core entities and JSONB only for variable test configuration, response metadata,
and adapter-specific fields.

Key tables:

| Table | Responsibility |
| --- | --- |
| `projects` | Workspaces, ownership, default settings. |
| `users` | Authenticated principals (local password hash and/or external subject). |
| `api_tokens` | Long-lived tokens for CI and programmatic access, hashed at rest. |
| `user_project_roles` | Role assignment of a user within a project. |
| `environments` | Runtime contexts for a project. |
| `environment_variables` | Non-secret variables and secret references. |
| `secrets` | Encrypted secret values or external-manager references. |
| `targets` | Named applications-under-test: base URL, health URL, default auth ref. |
| `test_definitions` | Stable test identity, type, tags, status, current revision. |
| `test_revisions` | Immutable code reference or request config. |
| `request_test_specs` | Query-friendly projection of UI-created HTTP request tests. |
| `test_suites` | Suite metadata. |
| `test_suite_items` | Ordered test membership and per-item overrides. |
| `schedules` | Recurrence policy and next due time. |
| `run_queue` | Claimable execution work items. |
| `suite_runs` | Suite/launch-level execution summary. |
| `test_runs` | One test execution and final status (executed or imported). |
| `test_run_attempts` | Retry attempts for a run. |
| `test_run_steps` | Step-level status, timing, and errors. |
| `test_run_assertions` | Per-assertion source, operator, expected, actual, result. |
| `run_logs` | Structured logs, ordered by run and timestamp. |
| `artifacts` | Screenshot, video, trace, body, HAR, and log bundle metadata. |
| `failure_signatures` | Deduplicated normalized failure groups with last known defect type. |
| `run_defects` | Defect-type triage per failed run (suggested and confirmed). |
| `result_imports` | Ingested external result batches and their source metadata. |
| `workers` | Worker registration and capabilities. |
| `worker_heartbeats` | Liveness and load reporting. |
| `custom_dashboards` | User-owned dashboards. |
| `dashboard_widgets` | Widget layout and config. |
| `audit_events` | Security and domain audit history. |

PostgreSQL conventions:

- Use `UUID` for externally exposed ids.
- Use `BIGINT GENERATED ALWAYS AS IDENTITY` for dense event/log ids.
- Use `TIMESTAMPTZ` for all timestamps.
- Use `TEXT` plus `CHECK` constraints for evolving status values.
- Use JSONB with `CHECK (jsonb_typeof(config) = 'object')` for configs.
- Add indexes for every foreign key.
- Add partial indexes for hot subsets such as queued work and failed runs.
- Add BRIN indexes on very large time-ordered log/run tables.

Important indexes:

```sql
CREATE INDEX idx_test_definitions_project_status
  ON test_definitions (project_id, status);

CREATE INDEX idx_test_definitions_tags
  ON test_definitions USING GIN (tags);

CREATE INDEX idx_schedules_due
  ON schedules (next_run_at)
  WHERE is_enabled = true;

CREATE INDEX idx_run_queue_claim
  ON run_queue (available_at, priority DESC, created_at)
  WHERE status = 'queued';

CREATE INDEX idx_test_runs_test_started
  ON test_runs (test_definition_id, started_at DESC);

CREATE INDEX idx_test_runs_project_status_started
  ON test_runs (project_id, status, started_at DESC);

CREATE INDEX idx_test_runs_target_started
  ON test_runs (target_id, started_at DESC);

CREATE INDEX idx_run_logs_run_timestamp
  ON run_logs (test_run_id, created_at);

CREATE INDEX idx_run_logs_recent_brin
  ON run_logs USING BRIN (created_at);
```

For high-volume installations, partition `run_logs`, `test_run_steps`, and
possibly `test_runs` by month on `created_at` or `started_at`.

## 16. API Surface

QTP API paths use `/api` below the QF namespace. The namespace is `qtp`.

Core endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /health`, `GET /liveness`, `GET /readiness` | Service health. |
| `POST /api/auth/login`, `POST /api/auth/refresh` | Obtain and refresh JWTs. |
| `GET /api/me` | Current user, roles, project access. |
| `GET /api/projects` | Project list. |
| `GET /api/targets`, `POST /api/targets`, `PATCH /api/targets/{id}` | Manage apps-under-test. |
| `GET /api/tests` | Search and filter test definitions. |
| `POST /api/tests/discover` | Import code-based tests from configured modules. |
| `GET /api/tests/{id}` | Test detail, revisions, latest status. |
| `POST /api/tests/{id}/run` | Start an immediate run. |
| `POST /api/request-tests/send` | Send an unsaved on-demand request. |
| `POST /api/request-tests` | Save a request as a managed test. |
| `PATCH /api/request-tests/{id}` | Create a new revision of a request test. |
| `GET /api/suites`, `POST /api/suites`, `POST /api/suites/{id}/run` | Manage and run suites. |
| `GET /api/runs` | Search runs by project, test, target, status, trigger, date. |
| `GET` / `DELETE` | `/api/runs/{id}` | Read run metadata, or permanently delete the run. |
| `DELETE`| `/api/runs` | Permanently delete all runs across all targets. |
| `GET`  | `/api/runs/{id}/logs` | Paginated structured logs. |
| `POST /api/runs/{id}/cancel` | Cancel queued or running run. |
| `PUT /api/runs/{id}/defect` | Set/confirm the defect type for a failed run. |
| `POST /api/imports` | Ingest externally-produced results (JUnit/JSON). |
| `GET /api/schedules`, `POST /api/schedules`, `PATCH /api/schedules/{id}`, `DELETE /api/schedules/{id}` | Manage recurrence. |
| `GET /api/dashboards/overview` | KPI cards and chart aggregates. |
| `GET /api/dashboards/failures` | Failure and defect analytics. |
| `GET /api/workers` | Worker status and capabilities. |
| `GET /api/audit` | Audit explorer. |

Handlers validate payloads with Pydantic schemas before calling services.
Responses are serialized through explicit serializer functions so the API does
not leak ORM internals.

## 17. Frontend Architecture

The UI follows the operational style from Tickora: Ant Design layout, left
navigation, utility header, dense tables, drawers, modals, and charts. It is not
a marketing-style landing page. The first screen after login is the QTP
operational dashboard.

```text
frontend/src/
  QtpApp.tsx
  main.tsx
  api/
    client.ts
    auth.ts
    tests.ts
    targets.ts
    runs.ts
    schedules.ts
    dashboards.ts
    defects.ts
    imports.ts
    workers.ts
  stores/
    sessionStore.ts
    themeStore.ts
    requestBuilderStore.ts
  pages/
    OverviewPage.tsx
    TestCatalogPage.tsx
    TestDetailPage.tsx
    RequestBuilderPage.tsx
    SuitesPage.tsx
    RunsPage.tsx
    RunDetailPage.tsx
    SchedulesPage.tsx
    DashboardPage.tsx
    TargetsPage.tsx
    WorkersPage.tsx
    DocsPage.tsx
    AdminPage.tsx
  components/
    common/
    request-builder/
    runs/
    dashboards/
    tests/
```

Navigation groups:

- Monitor: Overview, Dashboards, Runs, Failures.
- Tests: Catalog, Suites, Request Builder, Schedules.
- Operations: Workers, Queue, Artifacts, Imports, Audit.
- Admin: Projects, Targets, Environments, Secrets, Users.
- Developer Docs: an in-app documentation tab (see section 17.1).

Expected UI views:

- Overview dashboard with status cards, run trend, success rate, failures,
  defect breakdown, flaky tests, slowest tests, queue backlog, per-target health,
  and worker health.
- Test Catalog with filters by project, target, type, owner, tag, status, last
  result, flakiness, and duration.
- Test Detail with revision history, schedules, recent runs, failure history,
  artifacts, and "Run now".
- Request Builder with method selector, URL/target input, tabs for params,
  headers, auth, body, assertions, pre-request script, schedule, and response.
- Runs table with live status, trigger source, target, environment, worker,
  duration, and failure reason.
- Run Detail with timeline, steps, per-assertion results, logs, screenshots,
  response body, traces, retries, failure classification, and a defect-type
  triage control.
- Schedules page with recurrence editor, pause/resume, next run, last run, and
  misfire policy.
- Custom Dashboard page with user dashboards and widget catalogue.

Live run status uses TanStack Query polling by default, with an optional SSE
stream (Redis-backed) when configured; the sync Flask/RESTX stack does not
require WebSockets for the baseline experience. Use Ant Design tokens through a
root `ConfigProvider`; avoid broad global `.ant-*` CSS overrides.

### 17.1 In-App Developer Documentation

The UI ships a first-class **Developer Docs** tab (`DocsPage.tsx`) so a developer
never has to leave the platform to learn how to extend it. It is a rendered,
navigable guide — not a link to an external wiki — covering:

- **Concepts**: definitions, revisions, targets, runs, assertions, defect types,
  and how "test any app by URL" works.
- **Author a code-based test in Python**: subclass `BaseAutomationTest`, declare
  `TestMetadata`, resolve the target from `TestContext`, and implement the
  lifecycle hooks (`validate_config → setup → execute → cleanup → teardown`),
  with a full copy-pasteable example and where the file lives
  (`tests/automations/...`).
- **Register it**: how discovery imports configured modules, the idempotent
  create/revision behavior, and how to trigger `POST /api/tests/discover` from
  the UI.
- **Create a request test from the UI**: the request builder, target/URL,
  assertions on the response body/headers/timing, save, and edit.
- **Run it**: on demand (`Run now` / `POST /api/tests/{id}/run`) and on a
  recurrence (schedules: interval/cron), with the exact API payloads.
- **The assertion catalogue**: every source and operator, with JSON examples.
- **Extend the platform**: adding a new adapter/executor and a new dashboard
  widget, cross-referencing section 23.
- **API reference**: the endpoint map with request/response shapes and how to
  obtain a bearer token.

The content is authored as structured sections with syntax-highlighted code
snippets and lives alongside the app so it stays versioned with the code.

## 18. Dashboard And Reporting Model

Dashboards answer operational questions quickly:

- How many tests ran in the selected time window, per target?
- What is the pass, fail, error, timeout, and cancel rate?
- Which tests are currently failing, and what is the defect-type mix?
- Which failures are new, recurring, or flaky?
- Which tests became slower?
- Which schedules are late or paused?
- Which workers are overloaded or unhealthy?
- Which targets/environments have the worst failure rate?

Core metrics:

- total runs;
- pass rate;
- assertion failure rate;
- infrastructure error rate;
- timeout rate;
- p50, p90, p95, and p99 duration;
- queue wait time;
- retry rate;
- flakiness score (defined below);
- mean time to recovery for failing tests;
- failure signature count;
- defect-type distribution (product bug / automation bug / system issue / to
  investigate / no defect);
- schedule lateness;
- worker utilization.

A test's **flakiness score** is defined as the fraction of runs of the same
revision-and-environment pair that produced a different result than the run
before it, over a trailing window — i.e. how often it flips between pass and
fail without a code or config change. This makes "flaky" a computable metric and
filter rather than a label.

Recommended widgets:

- KPI card.
- Run trend line chart.
- Status breakdown stacked bar.
- Defect-type breakdown.
- Failure signature table.
- Flaky tests table.
- Slowest tests table.
- Target/environment comparison.
- Worker health grid.
- Queue backlog chart.
- Recent failed runs.
- Run log search.
- Schedule calendar.

Materialized views or aggregate tables are introduced after the raw query paths
are stable. Start with indexed queries, then add daily/hourly aggregates for
expensive dashboard cards.

## 19. Failure Classification And Defect Triage

QTP separates the mechanical **failure category** (what broke) from the
human-meaningful **defect type** (why it matters), mirroring ReportPortal.

Each failed run produces a normalized failure record with a category:

- `assertion_failed`;
- `http_status_mismatch`;
- `json_assertion_failed`;
- `timeout`;
- `network_error`;
- `browser_error`;
- `selenium_driver_error`;
- `cli_nonzero_exit`;
- `script_error`;
- `setup_error`;
- `teardown_error`;
- `worker_lost`;
- `canceled`;
- `unknown_error`.

The failure signature hash uses:

- test definition id;
- adapter type;
- error category;
- normalized exception class;
- normalized assertion path;
- normalized top stack frame or response assertion.

This groups failures even when timestamps, ids, or response values change
between runs.

**Defect triage** layers on top of the signature. Defect types are:

- `product_bug` — the app-under-test is broken;
- `automation_bug` — the test itself is wrong or brittle;
- `system_issue` — environment/infrastructure problem;
- `to_investigate` — not yet triaged (default for new failures);
- `no_defect` — an expected/known non-issue.

When a failed run matches an existing failure signature that a human previously
triaged, QTP suggests that defect type on the new run (`defect_triage.py`) and
optionally auto-applies it under a project policy. This is the deterministic
analog of ReportPortal's auto-analyzer: no ML or ElasticSearch required, driven
by the signature join key. Users confirm or override the suggestion in run
detail, and the confirmed type updates the signature's "last known defect type."

## 20. Security

The request builder can call arbitrary URLs, so QTP treats it as a high-risk
feature, and the SSRF controls ship **with** that feature, not in a later
hardening pass.

Required controls:

- SSRF protection in `core/net_guard.py`: resolve the hostname, validate the
  **resolved IP** against blocklists (private, loopback, link-local, and cloud
  metadata ranges such as `169.254.169.254`), and pin the outbound connection to
  the validated IP. Re-validate on **every redirect hop**, because
  `followRedirects` is allowed. Hostname-string checks alone are insufficient
  (DNS rebinding and redirect bypasses).
- Project-level outbound network allowlist, enforced at request time.
- Per-project and per-user rate limits.
- Request timeout and max response body size.
- Header, body, query, and log redaction for secrets.
- Encrypted secret storage (`secrets` table) or external secret manager
  references; secrets resolved only at execution time.
- Authentication via JWT (login) or hashed API tokens (CI), wired through
  `FrameworkSettings.init_app`; every non-health endpoint requires a principal.
- Role-based access for creating, editing, scheduling, running, importing, and
  triaging tests.
- Immutable audit events for test changes, schedule changes, target changes,
  secret access, manual runs, imports, and defect triage.
- Artifact access checks on every download.
- Browser and CLI/container test isolation in a worker subprocess or container.

Secrets are never copied into `test_revisions`. Revisions store secret
references only. Workers resolve secret values at execution time and redact them
before logs or artifacts are persisted.

## 21. Reliability And Concurrency

Important invariants:

- A test revision is immutable once used by a run.
- A queued run can be claimed by only one worker.
- Workers advertise capabilities (`http`, `playwright`, `selenium`, `cli`,
  `python`) in the `workers` table; claim logic matches a run's required
  capability so a browser test is not claimed by an HTTP-only worker. The claim
  query filters `run_queue` by capability alongside `available_at`/priority.
- Heavy test types (browser, CLI/container) carry a weight so a worker limits how
  many it runs concurrently, independent of light HTTP tests.
- Schedule enqueue and `next_run_at` update happen in one transaction.
- A canceled run stops producing new steps and artifacts after cancellation is
  observed (cooperative flag plus subprocess termination).
- A worker heartbeat timeout marks active runs as `error` with `worker_lost`.
- Retried attempts belong to one logical run.
- Dashboard aggregates and imports never modify prior run history.

Use PostgreSQL row locks and partial indexes for the initial queue. If QTP later
uses Kafka through QF ETL, PostgreSQL remains the authoritative lifecycle store;
Kafka messages carry ids and trigger workers to claim or update rows rather than
replacing persisted run state.

## 22. Observability

Every run has:

- correlation id;
- run id;
- test definition id;
- revision id;
- target id;
- schedule id when applicable;
- worker id;
- environment id;
- trigger type (`manual`, `schedule`, `api`, `suite`, `discovery`, `imported`).

Logs are structured JSON rows in PostgreSQL and optionally mirrored to stdout.
The UI supports paginated log viewing and text search using keyset pagination on
the log's `BIGINT` id. Long logs are chunked and streamed to artifact storage
when row volume becomes too large.

Traces connect:

- API request that enqueued the run;
- queue claim;
- runner setup and target resolution;
- adapter execution;
- outbound HTTP call, browser step, or CLI process;
- artifact upload;
- final status persistence.

## 23. Extensibility

Adding a new test adapter requires:

1. Implementing a subclass of `BaseAutomationTest` or a new adapter base.
2. Registering adapter capabilities in `testkit.registry` and adding the
   capability to worker advertisement.
3. Adding config validation schema.
4. Adding result mapping to `TestResult` (including assertion mapping).
5. Adding frontend editor support only if the adapter is user-configurable.

Adding a new dashboard widget requires:

1. Backend query or aggregate function.
2. API response DTO.
3. Widget catalogue entry.
4. React widget component.
5. Permission rule for the widget.

Adding a new result-import format requires:

1. A parser in `ingestion/parsers.py` that maps the format to runs, steps, and
   assertions.
2. A content-type or discriminator on `POST /api/imports`.
3. Tests proving idempotent, correctly-classified ingestion.

This keeps QTP maintainable as new automation styles, target apps, and reporting
sources are added.
