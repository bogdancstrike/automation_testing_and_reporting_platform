# QTP Multi-Step Tests And Target Observability Design

Date: 2026-07-07

## Summary

QTP will evolve from single-request HTTP tests plus code-based tests into a richer automation workbench that supports ordered multi-step HTTP flows, target-centered observability, and backend-driven operational tables. The implementation keeps the current platform shape: Python/Flask/QF backend, PostgreSQL persistence, durable worker execution, and React/Ant Design frontend.

The UI direction is a dense operations console: compact, scannable, chart-rich, and optimized for people who repeatedly run, debug, schedule, and triage tests.

## Goals

- Let users create HTTP tests with multiple ordered steps from the Request Builder.
- Let code tests and UI request tests expose step structure consistently in run results.
- Keep code-based tests file-based: one test per Python file under `backend/tests/automations/`, with the full context and test code inside that file.
- Auto-register code tests from `backend/tests/automations/` when they extend `BaseAutomationTest` or a subclass; no manual module registration should be required.
- Render a test's steps on `/tests/{id}` with React Flow, including current/latest run status when available.
- Add `/targets/{id}` so a target application has its own operational page with all tests, runs, ratios, charts, and failure information for that app.
- Enrich Overview, Developer Docs, and Request Builder without losing the existing runnable Docker experience.
- Make all table-backed UI data backend-driven for pagination, search, filtering, and sorting.
- Add reusable user-created tags and comments for tests and runs so users can annotate investigation state and find items later.

## Non-Goals

- No full suite execution model in this increment.
- No browser automation implementation beyond the current stubbed Playwright/Selenium adapters.
- No new database migration system in this increment; schema changes continue to work with the current `create_all` bootstrap until Alembic is tackled separately.
- No custom dashboard builder or drag-and-drop widgets.

## Core Data Model

### Multi-Step Request Config

Saved UI request tests will support this revision config shape:

```json
{
  "target": "orders_api",
  "variables": {
    "tenant": "demo"
  },
  "steps": [
    {
      "id": "login",
      "name": "Login",
      "method": "POST",
      "url": "{{base_url}}/api/login",
      "headers": [{"name": "Content-Type", "value": "application/json", "enabled": true}],
      "body": {"mode": "json", "raw": "{\"username\":\"admin\",\"password\":\"admin\"}"},
      "assertions": [
        {"type": "status_code", "operator": "equals", "expected": 200},
        {"type": "json_path", "path": "$.token", "operator": "exists"}
      ],
      "captures": [
        {"name": "auth_token", "source": "json_path", "path": "$.token"}
      ]
    },
    {
      "id": "create-order",
      "name": "Create order",
      "method": "POST",
      "url": "{{base_url}}/api/orders",
      "headers": [{"name": "Authorization", "value": "Bearer {{auth_token}}", "enabled": true}],
      "body": {"mode": "json", "raw": "{\"item\":\"widget\"}"},
      "assertions": [
        {"type": "status_code", "operator": "equals", "expected": 201},
        {"type": "json_path", "path": "$.id", "operator": "exists"}
      ],
      "captures": [
        {"name": "order_id", "source": "json_path", "path": "$.id"}
      ]
    },
    {
      "id": "verify-order",
      "name": "Verify order",
      "method": "GET",
      "url": "{{base_url}}/api/orders/{{order_id}}",
      "assertions": [
        {"type": "status_code", "operator": "equals", "expected": 200},
        {"type": "json_path", "path": "$.item", "operator": "equals", "expected": "widget"}
      ]
    }
  ]
}
```

Existing single-request configs remain valid. The backend treats a config with `method` and `url` but no `steps` as one implicit step. The UI can save the richer `steps` shape, and old saved request tests can still load and run.

### Step Execution Semantics

- Steps run sequentially.
- Each step uses the same HTTP adapter behavior that exists today: target resolution, templating, headers/body/auth, SSRF guard, redirect validation, response capture, timeout, and assertion evaluation.
- Step captures write values into the run context variables. Later steps can use `{{capture_name}}`.
- A failed assertion stops the flow by default. The final run status becomes `failed`.
- Network errors, blocked URLs, timeouts, and unexpected adapter exceptions stop the flow and become `error` or `timeout`.
- Per-step response summaries are stored in `TestResult.metrics` or `TestResult.response` under a `steps` collection so the run detail page can show step-by-step responses without changing the existing `test_run_steps` table shape.
- `TestRunStep` rows remain the durable step timeline. Assertions remain in `test_run_assertions`; each persisted assertion should include step context in its target/message when needed so users can tell which step failed.

## Code Test Discovery Contract

Code tests are Python files under `backend/tests/automations/`. A team that wants 10 code tests creates 10 Python files. Each file contains the test class, metadata, setup/execute/cleanup/teardown hooks, helper code specific to that test, and any local context needed to understand the test. Shared helper base classes may still exist for real duplication, but a test remains independently discoverable from its own file.

Discovery recursively scans `backend/tests/automations/`, imports Python modules under that tree, finds concrete classes extending `BaseAutomationTest` or one of its subclasses, and upserts their `TestDefinition`/`TestRevision` records. Users do not add the file to `AUTOMATION_MODULES` or any other manual registry. `metadata.key` remains the stable identity and must be unique. Tests removed from the directory are marked `missing_from_source`, not deleted.

The Developer Docs should teach this as the default workflow: create one Python file, subclass the base test, run discovery from the UI or API, then run or schedule the test.





## Backend Tracing

Critical backend paths should emit QF/OpenTelemetry spans using `framework.tracing.get_tracer()` and `tracer.start_as_current_span(...)`, following the qflow and Tickora backend style. Required spans include run execution, flow execution, HTTP steps, captures, discovery, target stats, backend table queries, comments, and tag updates. Spans should include useful attributes such as run id, test id, target id, step id, method, status, duration, page size, and result counts. Tracing must rely on QF Framework tracing.py, which provides the NoOp behavior when disabled, and must not change business behavior when disabled.

## QF Framework Usage

Use QF Framework capabilities where they simplify the platform boundary: app/bootstrap conventions, dynamic endpoint registration, logging, configuration integration, and existing Flask/QF wiring. Keep domain logic, test execution, pagination, comments, tags, and target analytics as plain Python services so the architecture remains easy to understand and test. Do not add Kafka, ETL, or heavier QF subsystems unless a feature genuinely needs them.

## Horizontal Scalability

QTP API instances and worker instances must be horizontally scalable. New features must not depend on process-local state for correctness. APIs remain stateless behind a load balancer, and workers coordinate through PostgreSQL queue rows, transactional status updates, and `FOR UPDATE SKIP LOCKED` claiming. Comments, tags, target stats, pagination, request-step captures, and run results are persisted in PostgreSQL so any API instance can serve reads and any capable worker can execute queued work.

Long-running execution state belongs in the database or the run context for a single claimed run. A worker may keep in-memory variables only while executing that run; captured values needed after execution must be persisted in run results. Scheduler instances must continue to enqueue through locked due-schedule rows so multiple scheduler replicas do not duplicate work.

## Framework Ergonomics

The testing framework should be easy to understand and use. A new tester should be able to open one Python file, understand what app it targets, what steps it performs, what it asserts, and what it cleans up. Multi-step helpers should hide platform internals and use tester-facing names like step, request, capture, assert, and cleanup.

Backend abstractions should stay small and explicit: reusable helpers are welcome when they remove boilerplate from tests, but test authors should not need to understand the worker queue, ORM models, or request adapter internals to write a useful test. Developer Docs and examples should prefer complete, copyable tests over fragmented snippets.

## Backend API Contract

### Backend-Driven Tables

All UI tables must use backend pagination, filtering, searching, and sorting. This applies to Tests, Runs, Targets, Target Detail tests, Target Detail runs, Schedules, Workers where applicable, and Overview/Target failure tables when they become table-backed.

List endpoints return:

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 123,
  "sort": "queued_at",
  "order": "desc"
}
```

Common query parameters:

- `page`: one-based page number.
- `page_size`: capped by the backend.
- `q`: backend search term.
- `sort`: whitelisted field name.
- `order`: `asc` or `desc`.
- Endpoint-specific filters, such as `status`, `source`, `type`, `target`, `trigger`, `test_definition_id`, `target_id`, `environment`, and date windows.

Frontend components must not fetch all rows and then filter/sort/page locally. Small static option lists, such as target keys for a select, may still be fetched as option data.


### Tags And Comments

Users can add free-form tags to tests, such as `to investigate`, `cannot reproduce`, `flaky`, or `blocked`. Tags are created on demand when a user applies them, and the UI should offer existing tags for reuse. Test tags participate in backend search/filtering so users can find annotated tests later. Code-discovered metadata tags remain supported; user-applied tags use the same visible tag list for simplicity.

Users can leave comments on test detail pages and run detail pages. Comments include author, body, optional tags, and timestamps. A generic comment model keyed by entity type (`test` or `run`) is sufficient for this increment. Comments are append-only in the first version; editing/deleting can be added later if needed.

Run and test table APIs should support backend search/filter/sort for fields users naturally search by: name/key/status/target/tags for tests, and test name/status/target/trigger/defect/failure category for runs.

### New And Changed Endpoints

- `GET /api/targets/{target_id}` returns target metadata plus aggregate statistics.
- `GET /api/targets/{target_id}/tests` returns paginated, searchable, sortable tests for that target.
- `GET /api/targets/{target_id}/runs` returns paginated, searchable, sortable runs for that target.
- `GET /api/targets/{target_id}/stats` returns chart-ready aggregates for pass/fail ratio, status distribution, duration trend, run trend, failure categories, and latest per-test status.
- `GET /api/tests/{test_id}` includes normalized `steps` for the current revision. Code tests may expose a reflected Python-file node plus discovered historical run steps; UI tests expose configured steps.
- `GET /api/dashboards/failures` includes `test_definition_id` for each recent failure so Overview can route to `/tests/{id}?runId={run_id}`.
- Existing list endpoints are upgraded to the paginated envelope without dropping compatibility abruptly in service internals.
- `GET /api/tags` returns reusable tag suggestions collected from tests and comments.
- `PUT /api/tests/{test_id}/tags` updates a test's visible tags.
- `GET /api/tests/{test_id}/comments` and `POST /api/tests/{test_id}/comments` list/add test comments.
- `GET /api/runs/{run_id}/comments` and `POST /api/runs/{run_id}/comments` list/add run comments.

## Frontend Design

### Visual Direction

The UI uses a restrained operations-console style:

- Compact KPIs and dense tables.
- Clear status color usage for passed, failed, error, timeout, queued, and running.
- Clickable rows with predictable navigation.
- Charts used for operational insight, not decoration.
- Responsive layouts that remain usable on laptop screens.
- Sidebar navigation stays sticky/fixed at viewport height; page scrolling happens in the main content area only.

### Runs

- Runs page uses backend search/filter/sort, including status, trigger, target, defect type, failure category, and text search by test name/key.
- Run detail page includes a comments panel where users can add investigation notes and optional tags.

### Overview

Overview becomes a stronger control-plane landing page:

- KPI band: total runs, pass rate, fail/error/timeout counts, queue backlog, active workers, p50/p95 duration.
- Charts: run trend by status, status distribution, defect distribution, target health, slowest tests or duration trend.
- Recent failures table: rows are clickable and navigate to the failed test detail page with `runId` in the query string. The test page then highlights the relevant recent run/failure context.
- Per-target health links to `/targets/{id}` rather than only showing target keys.

### Target Detail Page

`/targets/{id}` is the operational home for one application-under-test:

- Header with name, key, base URL, health URL, environment, tags, and quick actions.
- KPI band: run count, pass rate, failed/error count, timeout count, median/p95 duration, number of tests, number of scheduled tests.
- Charts: run trend, status distribution, duration trend, failure categories or defect types.
- Tests table for all test definitions attached to the target, using backend pagination/search/filter/sort.
- Runs table for executions against the target, using backend pagination/search/filter/sort.
- Failure panel with recent failures and common signatures.

### Test Detail Page

`/tests/{id}` gains a visual flow tab:

- React Flow renders configured request steps for UI tests.
- Existing single-request UI tests render as one node.
- Code tests render a Python-file node and can show latest run steps when a run is selected.
- When opened with `?runId=...`, the page loads that run and colors nodes by step status where names/ids match.
- Existing source/config, assertions, revisions, and recent runs tabs remain available.
- Test detail page includes comments and editable/reusable tags so users can annotate investigation state.

### Request Builder

Request Builder supports two authoring modes:

- Single Request mode for quick one-off HTTP tests.
- Flow mode for multi-step tests.

Flow mode features:

- Step list/sidebar with add, duplicate, delete, rename, and reorder.
- Per-step method/target/url/header/body/assertion editors.
- Captures editor for JSON path/header/body text values.
- Send Flow action that executes all steps and shows a step-by-step response timeline.
- Save/Update creates a revision with `config.steps`.
- Schedule works exactly as it does for single-request saved tests.

### Developer Docs

Developer Docs will add:

- Multi-step UI request example with login, POST, and GET verification.
- Capture and variable templating explanation.
- Python code example for multi-step logic with `execute_http`.
- One-file-per-test code discovery workflow under `backend/tests/automations/`, with no manual registration list.
- Target detail page explanation.
- Backend table contract: pagination, filters, search, sort.
- API reference updates for target detail and paginated list endpoints.
- `docs/TODO.md` maintenance expectations: update the tracker when major items are completed, partially done, or deliberately deferred.

## Error Handling

- Invalid multi-step configs return validation errors before saving or sending.
- Missing step ids are generated by the frontend for new flows and normalized by the backend for old configs.
- Duplicate step ids in one test are rejected.
- Capture failures fail the step unless the capture is marked optional.
- SSRF and timeout errors preserve the current clean error-result behavior.
- Backend sorting only accepts whitelisted fields. Invalid sort fields return a validation error.

## Testing And Verification

Backend verification:

- Multi-step adapter execution passes values between steps.
- Code discovery recursively finds one-test-per-file Python tests under `backend/tests/automations/` without manual module registration.
- Single-request configs still run unchanged.
- Failed step assertions stop the flow and persist failed step/assertion data.
- Capture extraction works for JSON path and header.
- Recent failures include `test_definition_id`.
- Target detail endpoints return correct aggregates.
- Pagination/search/filter/sort work on tests, runs, targets, and target-specific tables.

Frontend verification:

- Request Builder can create, edit, send, save, update, delete, and schedule a multi-step test.
- `/tests/{id}` renders a React Flow diagram for saved steps.
- `/targets/{id}` loads metadata, charts, tests, and runs.
- Overview recent failures route to test detail.
- Table controls issue backend query params and do not filter/sort/page locally.
- Production frontend build succeeds.
- `docs/TODO.md` reflects completed, partial, and remaining work for this increment.

## Rollout Notes

The implementation should preserve the current Docker Compose quick start and seeded demo. Seeds should include at least one multi-step UI test where feasible, using httpbin endpoints that demonstrate capture and follow-up validation without requiring a separate mutable demo app.
