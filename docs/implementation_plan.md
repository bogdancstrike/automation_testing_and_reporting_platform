# QSINT Testing Platform Implementation Plan

**Goal:** Build QTP as a Python/Flask/QF/PostgreSQL automation testing platform
with a React/Vite/Ant Design UI for testing **any target application** —
managing code-based automation tests, Postman-like on-demand request tests with
response-body assertions, scheduled recurrence, runs, logs, artifacts, imported
results, dashboards, and defect triage. QTP combines Testkube-style execution
with ReportPortal-style centralized reporting.

**Architecture:** Implement QTP as a backend modulith with clean module
boundaries, QF dynamic endpoints at the HTTP edge, PostgreSQL as the lifecycle
source of truth, and worker processes for test execution. The frontend is an
operational Ant Design SPA with dense dashboards, test catalog, request builder,
schedule management, run inspection, and failure/defect analytics.

**Tech Stack:** Python 3.12, Flask 3, QF Framework, SQLAlchemy 2, Alembic,
PostgreSQL, Pydantic 2, Playwright, Selenium, requests, flask-jwt-extended,
React 19, TypeScript, Vite, Ant Design 6, TanStack Query, Zustand, ECharts.

---

## 1. Delivery Strategy

Build in vertical slices. Each phase must leave the product runnable and
testable:

1. Backend and frontend scaffold (with a minimal auth gate).
2. Database schema and core infrastructure.
3. Test framework SDK, adapters, and code-based discovery.
4. Targets and environments (apps-under-test).
5. Execution queue and worker lifecycle.
6. On-demand HTTP request tests with response-body assertions.
7. Scheduler and recurrence.
8. Suites.
9. Run logs, artifacts, failure classification, and defect triage.
10. Result ingestion (import external results).
11. Reporting APIs and dashboard aggregates.
12. Frontend shell, catalog, request builder, runs, dashboards.
13. Full RBAC, secrets, audit, and production hardening.

Use frequent migrations and tests. The API and worker should start before the UI
is feature complete, and every dashboard metric should be backed by a tested
query. Security-sensitive behavior (auth gate and SSRF egress controls) lands
**with** the feature it protects, not in a final hardening pass.

## 2. Target Repository Structure

```text
.
  dist/qf-1.0.2-py3-none-any.whl
  config.py                # REQUIRED top-level Config class (QF loads config.Config)
  main.py                  # builds FrameworkApp AND serves the returned Flask app
  worker.py
  scheduler.py
  requirements.txt
  pyproject.toml
  alembic.ini
  docker-compose.yml
  maps/
    endpoint.json
  migrations/
    env.py
    versions/
  src/
    config.py              # richer settings, referenced by top-level config.py
    core/
    iam/
    testkit/
    catalog/
    execution/
    ingestion/
    scheduling/
    reporting/
    audit/
    api/
    workers/
  tests/
    automations/
    unit/
    integration/
    e2e/
  frontend/
    package.json
    vite.config.ts
    src/
```

## 3. Phase 1 - Project Scaffold

**Objective:** Create a runnable backend API shell and frontend shell named
QSINT Testing Platform - QTP, wired correctly to the QF wheel.

**QF integration (do these exactly — verified against the wheel source):**

- Create a **top-level `config.py`** exposing a `Config` class.
  `framework.api.server.create_app` calls `app.config.from_object('config.Config')`
  and ETL bootstrap calls `from config import Config`; a `src/config.py` alone
  will not be found. `src/config.py` may hold richer settings and be imported by
  the top-level `config.py`.
- In `main.py`, construct `FrameworkSettings(enable_etl=False, enable_api=True,
  enable_dynamic_endpoints=True, ...)`. `enable_etl` defaults to `True` and
  `FrameworkApp.run()` raises `RuntimeError` without Kafka config.
- After `FrameworkApp(settings, app_root=...).run()`, **serve the returned Flask
  app explicitly** (`handles.app.run(host, port)` for local, gunicorn in prod).
  `run()` registers endpoints but does not bind a server; `api_host`/`api_port`
  are unused by the runner.
- Add a minimal auth gate now via `FrameworkSettings.init_app`: register a
  `before_request` that requires a JWT/API token on `/api/*` (allow `/health`,
  `/liveness`, `/readiness`, `/api/auth/*`). Full RBAC comes in Phase 13; this
  prevents shipping open endpoints in the interim.

**Backend files:**

- Create `requirements.txt` with Flask, the QF wheel install note, SQLAlchemy,
  Alembic, psycopg, Pydantic, Playwright, Selenium, requests, flask-jwt-extended,
  pytest, ruff, and python-dotenv.
- Create top-level `config.py` (`Config` class) and `src/config.py`
  (environment-based settings).
- Create `main.py` using `framework.app.FrameworkApp` and `FrameworkSettings`,
  then serving the app.
- Create `maps/endpoint.json` with the `qtp` namespace, `models`, and health +
  `auth` endpoints, using the required QF schema (`namespaces`, `models`,
  `endpoints[{namespace, operation_name, model_name, request_method[], api_url,
  exec_method{module_name, method_name}}]`). Give bodyless endpoints a null
  model.
- Create `src/api/health.py` and a stub `src/api/auth.py`.
- Create `src/core/errors.py`, `src/core/correlation.py`, and `src/core/db.py`.
- Create `worker.py` and `scheduler.py` as no-op process entrypoints that load
  config and log startup.

**Frontend files:**

- Create Vite React TypeScript app under `frontend/`.
- Create `frontend/src/QtpApp.tsx`.
- Create `frontend/src/api/client.ts` and `frontend/src/api/auth.ts`.
- Create `frontend/src/stores/themeStore.ts` and `sessionStore.ts`.
- Create initial routed pages: `OverviewPage`, `TestCatalogPage`,
  `RequestBuilderPage`, `RunsPage`, `SchedulesPage`, `TargetsPage`,
  `WorkersPage`, `AdminPage`, plus a login view.

**Verification:**

- `python main.py` starts and serves the API (not just builds it).
- `GET /health` returns status `ok` without a token; `GET /api/me` returns 401
  without a token.
- `npm run dev` starts the frontend and renders the QTP shell with sidebar
  navigation behind a login screen.

## 4. Phase 2 - Database And Migrations

**Objective:** Establish PostgreSQL schema, SQLAlchemy base, session handling,
and Alembic migrations.

**Create tables:**

- `projects`, `users`, `api_tokens`, `user_project_roles`
- `environments`, `environment_variables`, `secrets`
- `targets`
- `test_definitions`, `test_revisions`, `request_test_specs`
- `test_suites`, `test_suite_items`
- `schedules`
- `run_queue`, `suite_runs`, `test_runs`, `test_run_attempts`,
  `test_run_steps`, `test_run_assertions`
- `run_logs`, `artifacts`
- `failure_signatures`, `run_defects`
- `result_imports`
- `workers`, `worker_heartbeats`
- `custom_dashboards`, `dashboard_widgets`
- `audit_events`

**Backend files:**

- Create model modules in `src/iam/models.py`, `src/catalog/models.py`,
  `src/execution/models.py`, `src/scheduling/models.py`,
  `src/ingestion/models.py`, `src/reporting/models.py`, and
  `src/audit/models.py`.
- Create `migrations/env.py` that imports all models and uses
  `src.core.db.Base.metadata`.
- Create the initial migration.

**Schema rules:**

- Use `UUID` for external ids; `BIGINT` identity for dense log/event ids.
- Use `TIMESTAMPTZ` for timestamps.
- Use `TEXT` plus `CHECK` constraints for statuses, failure categories, and
  defect types.
- Use JSONB only for flexible config and metadata.
- Index all foreign keys, including `test_runs.target_id`.
- Add partial index for queued `run_queue` rows and a capability column for
  claim matching.
- Add BRIN index for `run_logs.created_at`.

**Verification:**

- `alembic upgrade head` creates all tables.
- `pytest tests/unit/test_db_models.py` validates enum/check values and model
  relationships.
- `pytest tests/integration/test_migrations.py` upgrades a fresh database.

## 5. Phase 3 - Test Framework SDK

**Objective:** Create the QTP base test abstraction and adapters for HTTP,
Playwright, Selenium, CLI/container tooling, and generic Python checks.

**Backend files:**

- Create `src/testkit/base.py` with `BaseAutomationTest` and `TestMetadata`.
- Create `src/testkit/context.py` with `TestContext`, **target resolution**
  (`context.target(...)` returning base URL/headers/auth), variable resolver,
  secret resolver interface, artifact writer interface, run logger interface, and
  a cooperative cancellation token.
- Create `src/testkit/result.py` with `TestResult`, `StepResult`,
  `AssertionResult`, `ArtifactRef`, and status constants.
- Create `src/testkit/assertions.py` implementing the full operator taxonomy
  from architecture section 10 (sources: status_code, header, json_path,
  body_text, json_schema, response_time_ms; operators: equals/not_equals,
  contains/not_contains, matches/not_matches, exists/not_exists, gt/gte/lt/lte,
  length_*, in/not_in).
- Create `src/testkit/registry.py` for importing configured modules and
  registering test classes by `metadata.key`.
- Create adapters:
  - `src/testkit/adapters/http.py`
  - `src/testkit/adapters/playwright.py`
  - `src/testkit/adapters/selenium.py`
  - `src/testkit/adapters/cli.py` (runs a command/container against the target,
    captures exit code and stdout/stderr, parses a JUnit/JSON result file into
    steps and assertions)
  - `src/testkit/adapters/python_script.py`

**Automation test layout:**

- Create `tests/automations/api/test_healthcheck.py` as the first example,
  resolving its URL from `context.target("api")`.
- Create `tests/automations/browser/test_example_login.py` as a skipped example
  until a target app is configured.
- Create `tests/automations/cli/test_k6_smoke.py` as a skipped example
  demonstrating the CLI executor.

**Verification:**

- Unit tests prove duplicate metadata keys are rejected.
- Unit tests prove invalid configs fail before execution.
- Unit tests prove each adapter maps success, assertion failure, exception, and
  timeout to the correct `TestResult` status.
- Unit tests cover every assertion operator, including body-content checks.

## 6. Phase 4 - Targets, Catalog, And Discovery

**Objective:** Model apps-under-test and persist code-based tests as
`test_definitions` and immutable `test_revisions`.

**Backend files:**

- Create `src/catalog/service.py` target CRUD (`list_targets`, `create_target`,
  `update_target`) and `src/api/targets.py`.
- Create `src/catalog/schemas.py` for discovery, target, and test filters.
- Extend `src/catalog/service.py` with:
  - `discover_tests(project_id, modules)`
  - `list_tests(filters)` (including a `target` filter)
  - `get_test_detail(test_definition_id)`
  - `create_revision(test_definition_id, revision_payload)`
  - `archive_test(test_definition_id)`
- Create `src/catalog/serializers.py`.
- Create `src/api/tests.py`.
- Add endpoints to `maps/endpoint.json`.

**Behavior:**

- Targets carry `base_url`, optional `health_url`, optional default auth ref,
  and optional environment binding.
- Discovery imports configured modules from `tests/automations`.
- New metadata key creates a new definition; existing key creates a new revision
  only when code reference or default config changed; old revisions stay
  immutable.
- Deleted code tests are marked `missing_from_source`, not deleted.

**Verification:**

- Unit tests cover discovery idempotency and target resolution.
- Integration tests cover definition creation, revision creation, and archive
  behavior.
- API tests cover list filters by target, type, tag, owner, status, and last
  result.

## 7. Phase 5 - Execution Queue And Worker

**Objective:** Execute tests through a durable PostgreSQL queue with
capability-aware worker claiming and lifecycle persistence.

**Backend files:**

- Create `src/execution/queue.py` with enqueue, claim, heartbeat, release, and
  cancel operations.
- Create `src/execution/lifecycle.py` with status transitions.
- Create `src/execution/runner.py` with adapter dispatch, target resolution, and
  timeout handling.
- Create `src/execution/service.py` for `run_now`, `list_runs`,
  `get_run_detail`, and `cancel_run`.
- Create `src/execution/logs.py` for structured log writes.
- Create `src/workers/execution_worker.py`; update `worker.py` to run its loop.
- Create `src/api/runs.py`.

**Queue behavior:**

- Claim queued rows with `FOR UPDATE SKIP LOCKED`, filtering by **worker
  capability** so a browser test is not claimed by an HTTP-only worker.
- Respect `available_at`, priority, project concurrency, test concurrency, and
  per-worker weight for heavy test types.
- Mark stale claimed runs as `error` with category `worker_lost`.
- Cancellation: queued runs are skipped; running runs are stopped cooperatively
  (flag polled by the worker) and terminated after a grace period.
- Use attempts for retries; retries do not create new logical runs.
- Persist final run status in the same transaction as final attempt status.

**Verification:**

- Unit tests cover legal and illegal lifecycle transitions.
- Integration tests prove two workers cannot claim the same run and that
  capability filtering routes correctly.
- Integration tests prove cancellation works for **both queued and running**
  runs.
- Worker test runs the example healthcheck automation end to end against a target.

## 8. Phase 6 - On-Demand Request Builder Backend

**Objective:** Let users send unsaved requests against any URL, assert on the
response output, and save request configs as QTP tests — with SSRF controls
enforced from day one.

**Backend files:**

- Create `src/core/net_guard.py`: resolve hostname, validate the resolved IP
  against private/loopback/link-local/metadata blocklists and the project
  allowlist, pin the connection to the validated IP, and re-validate on every
  redirect hop.
- Create `src/catalog/request_test_schema.py` with Pydantic models for method,
  URL/target, query, headers, cookies, auth, body, assertions, redirects, TLS,
  timeout, and recurrence.
- Complete `src/testkit/adapters/http.py` execution logic if not finished in
  Phase 3, routing all outbound calls through `net_guard`.
- Create `src/catalog/request_test_service.py` with:
  - `send_unsaved_request`
  - `create_request_test`
  - `update_request_test_revision`
  - `render_request_preview`
- Create `src/api/request_tests.py`; add endpoints to `maps/endpoint.json`.

**Security behavior (enforced here, not deferred):**

- Enforce project outbound allowlists and IP blocklists via `net_guard` on both
  unsaved sends and saved runs.
- Enforce max response body size and request timeout.
- Redact configured secret values from logs; store secret references, not
  values, in revisions.

**Verification:**

- Unit tests cover validation for invalid URL, invalid method, bad header name,
  and unsupported body mode.
- Unit tests cover assertion evaluation on body, headers, and timing.
- Security tests prove blocked hosts, private IPs, metadata IPs, and
  redirect-to-blocked-host cannot be called.
- Integration tests cover unsaved send, saved request test creation, immediate
  run, and schedule creation from the request builder.

## 9. Phase 7 - Scheduler And Recurrence

**Objective:** Create recurring runs from schedules without executing tests in
the scheduler process.

**Backend files:**

- Create `src/scheduling/recurrence.py` for `once`, `interval`, and `cron`
  next-run calculation.
- Create `src/scheduling/service.py` for CRUD, pause, resume, and due schedule
  processing.
- Create `src/scheduling/scheduler.py` for polling due schedules; create
  `src/workers/scheduler_worker.py`; update `scheduler.py` to run the loop.
- Create `src/api/schedules.py`.

**Schedule behavior:**

- Compute recurrence using schedule timezone.
- Enqueue runs and update `next_run_at` in one transaction.
- Enforce `max_concurrent_runs`; apply misfire policy (`skip`, `enqueue_once`,
  `catch_up_limited`); add jitter when configured.

**Verification:**

- Unit tests cover cron and interval next-run calculation across timezones.
- Integration tests prove due schedules enqueue exactly once under concurrent
  scheduler loops.
- Integration tests cover pause/resume and schedule deletion.

## 10. Phase 8 - Suites

**Objective:** Run ordered groups of tests as a single reportable unit
(ReportPortal-style launch).

**Backend files:**

- Create `src/execution/suite_service.py` (or extend `execution/service.py`) for
  `create_suite`, `run_suite`, and suite-run aggregation.
- Create `src/api/suites.py`; add endpoints to `maps/endpoint.json`.

**Behavior:**

- Enqueue suite items as individual `test_runs` linked to a `suite_run`.
- Support ordered vs parallel execution and `fail_fast`.
- Apply per-item environment/target overrides.
- Derive suite status from child statuses; expose a combined timeline.

**Verification:**

- Unit tests cover suite status derivation and fail-fast.
- Integration tests run a mixed suite and verify aggregation, ordering, and
  overrides.

## 11. Phase 9 - Logs, Artifacts, Failure Analytics, And Defect Triage

**Objective:** Make run failure analysis useful, durable, and triageable.

**Backend files:**

- Create `src/execution/artifacts.py` with local filesystem storage first and an
  S3-compatible storage interface second.
- Create `src/execution/failure_classifier.py`.
- Create `src/execution/defect_triage.py`: suggest a defect type on a new
  failure by matching its failure signature to prior human-confirmed triage;
  optionally auto-apply per project policy.
- Extend `src/execution/logs.py` with keyset pagination and filtering.
- Create `src/api/defects.py` (`PUT /api/runs/{id}/defect`) and extend
  `src/api/runs.py` with log, assertion, and artifact endpoints.

**Behavior:**

- Persist structured logs with timestamp, level, message, step, and context.
- Store screenshots, videos, Playwright traces, Selenium screenshots, response
  bodies, HAR files, and log bundles.
- Classify failures into stable categories and compute failure signature hashes.
- Suggest defect types; record confirmed types on `run_defects` and update the
  signature's last known defect type.
- Redact secrets before writing logs and artifacts.

**Verification:**

- Unit tests cover failure classification categories and defect-type suggestion
  from a matched signature.
- Unit tests cover secret redaction in nested JSON structures.
- Integration tests upload and download an artifact with permission checks.
- Run detail API returns steps, assertions, logs, artifacts, failure signature,
  and suggested/confirmed defect type.

## 12. Phase 10 - Result Ingestion

**Objective:** Centralize results from tests QTP did not execute (CI, external
frameworks), matching ReportPortal's ingestion.

**Backend files:**

- Create `src/ingestion/parsers.py` (JUnit XML and generic JSON) and
  `src/ingestion/service.py`.
- Create `src/api/imports.py` (`POST /api/imports`); add to `maps/endpoint.json`.

**Behavior:**

- Accept a launch payload (project, optional suite/target/environment, trigger
  `imported`) with JUnit XML or JSON results.
- Normalize into `suite_runs`, `test_runs`, steps, and assertions; map external
  pass/fail to QTP statuses/categories.
- Match definitions by a stable external key so history accumulates; unknown
  tests create lightweight `imported`-type definitions.
- Exclude imported runs from queue/worker metrics; include them in pass-rate,
  history, and defect analytics.

**Verification:**

- Unit tests cover JUnit and JSON parsing and status mapping.
- Integration tests prove idempotent re-import and history accumulation.

## 13. Phase 11 - Reporting APIs And Dashboard Aggregates

**Objective:** Provide operational metrics for overview and custom dashboards,
including per-target and defect analytics.

**Backend files:**

- Create `src/reporting/queries.py` with indexed raw queries.
- Create `src/reporting/service.py` with overview, trends, failures, defect
  distribution, flaky tests, slow tests, per-target health, worker health, and
  queue backlog.
- Create `src/reporting/materialized_views.py` after query paths stabilize.
- Create `src/api/dashboards.py`; create migration for optional aggregate tables
  or materialized views.

**Metrics:**

- total runs; pass/fail/error/timeout/cancel rates;
- p50, p90, p95, p99 duration; queue wait time; retry rate;
- flakiness score (result-flip fraction over a trailing window per
  revision-and-environment);
- failure signature counts; defect-type distribution;
- schedule lateness; worker utilization; per-target failure rate.

**Verification:**

- Unit tests cover metric math, including the flakiness definition.
- Integration tests seed runs (executed and imported) and verify dashboard API
  totals.
- Query plans for dashboard endpoints use indexes on realistic seed data.

## 14. Phase 12 - Frontend Shell And API Client

**Objective:** Build the QTP Ant Design application shell and typed API layer.

**Frontend files:**

- Implement `frontend/src/QtpApp.tsx` with Ant Design `Layout`, sidebar, mobile
  drawer, theme toggle, user menu, login flow, and route guards.
- Implement `frontend/src/api/client.ts` with base URL normalization, JWT/token
  provider, request interceptor, and normalized errors; implement
  `frontend/src/api/auth.ts`.
- Implement typed API modules: `tests.ts`, `targets.ts`, `runs.ts`,
  `requestTests.ts`, `schedules.ts`, `dashboards.ts`, `defects.ts`,
  `imports.ts`, `workers.ts`.
- Implement shared components: `StatusTag`, `TestTypeTag`, `DefectTag`,
  `DurationText`, `RunStatusIcon`, `PageHeaderActions`.

**Verification:**

- `npm run build` succeeds; route navigation works on desktop and mobile widths;
  API errors display clear Ant Design messages; unauthenticated users are
  redirected to login.

## 15. Phase 13 - Test Catalog And Targets UI

**Objective:** Let users manage targets and discover, filter, inspect, and run
tests.

**Frontend files:**

- Implement `TargetsPage.tsx` for managing apps-under-test (base URL, health URL,
  environment binding).
- Implement `TestCatalogPage.tsx` with table filters for project, target, type,
  tag, owner, status, last result, flakiness, and duration.
- Implement `TestDetailPage.tsx` with tabs: Overview, Runs, Revisions,
  Schedules, Artifacts, Settings.
- Implement run-now modal with target/environment and variable overrides.
- Implement discover-tests action for users with permission.

**Verification:**

- Catalog table preserves filters in URL search params.
- Run-now creates a run and navigates to run detail.
- Empty, loading, and error states are implemented.

## 16. Phase 14 - Request Builder UI

**Objective:** Provide a Postman-like request creation and scheduling workflow
that asserts on response output.

**Frontend files:**

- Implement `RequestBuilderPage.tsx`.
- Create components under `frontend/src/components/request-builder/`:
  `MethodUrlBar` (with target/environment picker), `ParamsEditor`,
  `HeadersEditor`, `AuthEditor`, `BodyEditor`, `AssertionsEditor`,
  `ScheduleEditor`, `ResponseViewer`, `SaveRequestTestModal`.

**UI behavior:**

- Method selector and URL/target input stay visible.
- Tabs separate Params, Headers, Auth, Body, Assertions, and Schedule.
- The assertions editor supports the full operator taxonomy against
  status/body/headers/timing, not just status code.
- Send runs an unsaved request and shows response status, time, headers, body,
  per-assertion results, and logs.
- Save creates a managed request test; schedule can be added while saving or
  later.

**Verification:**

- Component tests cover adding/removing headers and assertions and evaluating
  body assertions.
- Integration/E2E test sends a request to a mock endpoint, asserts on the body,
  and saves it.
- Long URLs, headers, and body content do not break layout.

## 17. Phase 15 - Runs, Run Detail, And Dashboards UI

**Objective:** Make failures easy to inspect and triage, and provide operational
dashboards.

**Frontend files:**

- Implement `RunsPage.tsx` with filters (including target) and live refresh via
  TanStack Query polling.
- Implement `RunDetailPage.tsx` with run summary, lifecycle timeline, attempts,
  steps, per-assertion results, logs with level/search filters, artifacts
  gallery, failure classification card, defect-type triage control, cancel-run
  action, and a raw request/response tab for HTTP tests.
- Implement `OverviewPage.tsx` (fixed operational dashboard) and
  `DashboardPage.tsx` (customizable widgets): KPI card, run trend, status
  breakdown, defect breakdown, failure signatures, flaky tests, slowest tests,
  per-target health, worker health, queue backlog, recent failed runs, schedule
  lateness.

**Verification:**

- Failed run detail shows exact failure reason, failing assertions, relevant
  logs, and defect type.
- Setting a defect type persists and updates analytics.
- Run status updates without manual refresh while a run is active.
- Dashboard cards match backend metric totals; widgets can be added, resized,
  moved, configured, and removed; mobile layout remains readable.

## 18. Phase 16 - IAM, RBAC, Secrets, Audit, And Production Hardening

**Objective:** Complete authorization, secret management, traceable history, and
production readiness. (A minimal auth gate and SSRF controls already shipped in
Phases 1 and 6.)

**Backend files:**

- Complete `src/iam/principal.py`, `src/iam/rbac.py`, `src/iam/decorators.py`,
  `src/iam/auth.py`, and `src/iam/service.py` (JWT login, API tokens, project
  role checks).
- Create `src/audit/events.py` and `src/audit/service.py`.
- Complete `src/core/secrets.py` (encrypted storage) or an external
  secret-manager adapter.
- Add audit calls to test/revision changes, schedule changes, target changes,
  manual runs, imports, secret resolution, defect triage, worker actions, and
  admin changes.

**Roles:**

- `qtp_admin`, `qtp_project_admin`, `qtp_test_author`, `qtp_operator`,
  `qtp_viewer`, `qtp_auditor` (as in architecture section 20, extended to cover
  targets, imports, and triage).

**Hardening work items:**

- Add Dockerfile and docker-compose for API, worker, scheduler, Postgres,
  optional Redis, optional object storage, and frontend.
- Add readiness and worker heartbeat checks.
- Add OpenTelemetry spans for API enqueue, queue claim, target resolution,
  runner execution, outbound HTTP/CLI calls, artifact writes, and final status
  persistence.
- Add retention jobs for old logs and artifacts.
- Add monthly partitioning for large run/log tables if needed.
- Add per-project/per-user rate limits for request tests and API actions.
- Add backup and restore notes for PostgreSQL and artifacts.

**Verification:**

- Unit tests cover every RBAC predicate; integration tests cover forbidden
  access for each role.
- Audit events are written in the same transaction as domain changes.
- Secrets are redacted from API responses, logs, and artifacts.
- Load test enqueues and executes a representative volume of HTTP request tests.
- Worker crash test marks active runs as `error`; scheduler concurrency test does
  not duplicate due runs; retention job deletes expired artifacts only after
  metadata policy allows it.

## 19. API Endpoint Map

The `maps/endpoint.json` grows per phase. Full intended surface:

```text
GET    /health
GET    /liveness
GET    /readiness
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/me
GET    /api/projects
GET    /api/targets
POST   /api/targets
PATCH  /api/targets/<target_id>
GET    /api/tests
POST   /api/tests/discover
GET    /api/tests/<test_id>
POST   /api/tests/<test_id>/run
POST   /api/request-tests/send
POST   /api/request-tests
PATCH  /api/request-tests/<test_id>
GET    /api/suites
POST   /api/suites
POST   /api/suites/<suite_id>/run
GET    /api/runs
GET    /api/runs/<run_id>
GET    /api/runs/<run_id>/logs
POST   /api/runs/<run_id>/cancel
PUT    /api/runs/<run_id>/defect
POST   /api/imports
GET    /api/schedules
POST   /api/schedules
PATCH  /api/schedules/<schedule_id>
DELETE /api/schedules/<schedule_id>
GET    /api/dashboards/overview
GET    /api/dashboards/failures
GET    /api/workers
GET    /api/audit
```

Add endpoints only when their service and tests exist. Give bodyless endpoints
(e.g. `DELETE`) a null model in `endpoint.json` so QF does not require a request
body. Avoid adding dead routes that return stub data.

## 20. Test Strategy

Backend:

- Unit tests for pure services, RBAC, recurrence, lifecycle, registry,
  assertions (all operators), failure classification, defect suggestion,
  ingestion parsers, and serializers.
- Integration tests with PostgreSQL for migrations, capability-aware queue
  claiming, schedule enqueueing, run lifecycle, suite aggregation, dashboard
  queries, ingestion idempotency, and audit.
- Worker tests for HTTP, CLI, and code-based automations.
- Security tests for request builder allowlist, blocked/private/metadata IPs,
  redirect bypass, redaction, and permission checks.

Frontend:

- Component tests for request builder editors (incl. body assertions), status
  and defect tags, run timeline, and dashboard widgets.
- API mock tests for list/filter pages.
- Playwright E2E tests for: create request test, send request with body
  assertion, save request test, schedule recurrence, run now, inspect and triage
  a failed run, import results, dashboard drill-down.

## 21. Definition Of Done

QTP is ready for a first production pilot when:

- users can register targets (apps-under-test) and both code-based and UI tests
  address any app by URL;
- users can discover code-based tests from `tests/automations`;
- users can create and save HTTP request tests from the UI that assert on the
  response body, headers, and timing — not only the status code;
- users can run tests immediately, on a recurrence, and as suites;
- workers execute HTTP, Playwright, Selenium, CLI/container, and Python tests
  through the same result contract, claimed by capability;
- external results can be imported and appear in history and analytics;
- run detail shows status, duration, attempts, steps, per-assertion results,
  logs, artifacts, failure reason, and defect type;
- failures group by signature and suggest a defect type from prior triage;
- dashboards show run totals, success/error rate, defect distribution, per-target
  health, failed tests, slow tests, flaky tests, queue backlog, and worker
  health;
- authentication is required on all non-health endpoints and RBAC protects
  project, target, run, schedule, secret, import, and audit actions;
- SSRF egress controls (resolved-IP validation, connection pinning, per-redirect
  re-checks, allowlists) are enforced on all outbound request-test calls;
- secrets are never persisted in revisions or logs;
- migrations, unit tests, integration tests, frontend build, and E2E smoke tests
  pass in CI.
```

