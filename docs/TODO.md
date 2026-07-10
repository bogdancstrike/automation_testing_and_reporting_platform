# QTP Implementation TODO

Living checklist of what is implemented vs. remaining. Reflects the code in
`backend/` and `frontend/`. See `architecture.md` and `implementation_plan.md`
for the full design.

_Last updated: 2026-07-07._

## Legend
- [x] done and verified
- [~] partial / simplified for the first runnable slice
- [ ] not started

## Horizontal scaling — Kafka worker transport (modulith, gevent+gunicorn)
- [x] Modulith: one image, shared `backend/src`, two entrypoints — `backend/` (API + scheduler) and top-level `worker/` (Kafka consumer), started/scaled independently
- [x] Both apps run under `gunicorn -k gevent` (greenlets, no OS threads); `backend/wsgi.py` + `worker/wsgi.py` + per-dir `gunicorn.conf.py`
- [x] Scheduler merged into the backend as a greenlet, single-active across replicas via `pg_try_advisory_lock` (separate `scheduler` service removed)
- [x] Run dispatch over Kafka topic `qtp-workers` (10 partitions): backend publishes `{run_id}` from the `session_scope` commit boundary (transactional outbox in `core/kafka_bus.py`); workers consume by partition, load the run from Postgres, execute, persist
- [x] Shared consumer group `WORKER_NAME=qtp-workers` splits partitions across replicas; per-container `WORKER_INSTANCE_ID` identity for the `workers` table
- [x] compose adds Kafka (KRaft, apache/kafka), kafka-ui (:8081), redis (QF ETL requirement), jaeger (:16686, OTLP :4317); worker scaled to `replicas: 3`
- [x] Domain tracing spans → Jaeger: `execution.publish_run`, `worker.consume_run`, `execution.run`, `http.execute`/`http.step`, `scheduling.tick`
- [x] Verified via `docker compose up`: topic created w/ 10 partitions, 3 workers split 4/3/3, batch of 30 runs distributed 11/10/9 all passed, full span tree in Jaeger, scheduler enqueues, queue_backlog drains to 0
- [ ] `execution/queue.py::claim_next` is now dead code (workers no longer poll the DB); the `test_db_execution.py` integration test still exercises it — retire/rewrite for the Kafka path
- [ ] Capability-aware routing not enforced over Kafka (single homogeneous group); revisit if heterogeneous workers are added

## Infrastructure & deploy
- [x] `docker-compose.yml`: postgres 17, kafka + kafka-ui, redis, jaeger, keycloak 26.1 (realm import), init, api (backend: API+scheduler), worker ×3, frontend
- [x] Backend `Dockerfile` (installs QF wheel + requirements)
- [x] Top-level `config.py` shim (QF requires importable `config.Config`)
- [x] Keycloak realm seed (`keycloak/realm-export.json`) — single `admin`/`admin` user with `qtp_admin`
- [x] DB init + seed (`backend/scripts/init_db.py`): project, demo target, discovery, sample UI test, schedule, one run
- [x] Frontend `Dockerfile` (nginx serving built SPA)
- [x] `.dockerignore` for backend/frontend build contexts
- [x] Alembic migrations for the initial schema, run actor/reset metadata, and multi-scenario schedule associations; `init_db` still keeps additive dev-schema compatibility for local databases

## Backend — framework/QF wiring
- [x] `main.py` boots FrameworkApp (enable_etl=False) and serves the Flask app
- [x] `worker.py` / `scheduler.py` entrypoints
- [x] `maps/endpoint.json` (27 routes under `/qtp`), handlers as `src.api.*`
- [x] CORS + correlation-id + error handlers installed on the Flask app

## Backend — core & IAM
- [x] `core/db.py` (engine, session_scope), `errors.py`, `correlation.py`, `clock.py`
- [x] `core/net_guard.py` SSRF: resolve host, block private/loopback/link-local/metadata, per-redirect re-check, allowlist
- [x] `iam` Keycloak JWT verify (JWKS internal-fetch / public-issuer split), Principal, role decorators
- [x] `AUTH_DISABLED` mode for local smoke tests
- [~] Users/RBAC: single admin from Keycloak; no DB `users`/`user_project_roles` tables yet
- [x] Encrypted secrets store (`secrets` table) — not implemented (demo uses inline/no secrets)
- [x] Audit events table + service

## Backend — testkit SDK
- [x] `BaseAutomationTest` + lifecycle hooks (`validate_config/setup/execute/cleanup/teardown`)
- [x] `TestContext` (target resolution, `{{var}}` templating, secret redaction, cancel token)
- [x] `TestResult` / `StepResult` / `AssertionResult`
- [x] Assertion engine — full operator taxonomy + minimal JSONPath
- [x] Registry discovery (unique keys, type/config validation)
- [x] HTTP adapter — real execution via net_guard, manual redirect + per-hop SSRF, body capture, assertions
- [~] CLI/Playwright/Selenium adapters — still need the requested runnable scenario coverage and worker image/browser dependency work

## Backend — domain
- [x] Catalog: projects, targets, test definitions, revisions, discovery, UI request tests
- [x] Execution: queue (FOR UPDATE SKIP LOCKED, capability-aware), runner, lifecycle, steps/assertions/logs
- [x] Failure classification + failure signatures + defect-type auto-suggestion
- [x] Scheduling: once/interval/cron recurrence (croniter), due processing, CRUD
- [x] Multi-scenario schedules: one schedule can own N scenarios, schedule detail shows every scenario, and due processing queues one run per scenario under the same schedule ID
- [x] Reporting: overview (totals, pass/error rate, p50/p95, trend, per-target, backlog), failures, workers
- [x] Worker loop (register/claim/execute/heartbeat/reap-stale) + scheduler loop
- [~] Suites, result ingestion, materialized views — modeled in docs, not built yet
- [x] Cancellation of a *running* run (cooperative flag exists; queued-cancel works; running-cancel not fully exercised)

## Backend — verification (done locally against real Postgres)
- [x] init_db creates tables + seeds
- [x] worker claims + executes the code healthcheck (passed) and UI request test
- [x] body `json_path` assertions evaluated; failure → signature + `to_investigate` defect
- [x] dashboard overview aggregates correct
- [x] Full stack via `docker compose up`: Keycloak token (admin/admin) → `/api/me`, 401 without token
- [x] Worker executes all 22 example tests through the running API; on-demand run flow verified
- [x] SSRF guard blocks metadata IP (169.254.169.254) with a clean error result
- [x] Frontend served by nginx (index.html + config.js)

## Frontend (AntD SPA)
- [x] Vite React TS scaffold + `Dockerfile`/nginx (builds clean)
- [x] Keycloak login (keycloak-js, PKCE) + token-attaching API client
- [x] API client (bearer token, base `/qtp`, normalized errors)
- [x] Layout shell (sidebar nav, header, user menu/logout)
- [x] Pages: `/overview`, Scenario Catalog (`/scenarios`), Scenario Detail, Request Builder, Runs, Run Detail, Schedules, Schedule Detail, Targets, Workers, Profile, Developer Docs
- [x] **Developer Docs tab**: Fumadocs-style developer guide with sticky navigation/TOC, architecture, scenario authoring, execution model, API usage, Request Builder, scheduling, CI, extension, and troubleshooting guidance
- [x] Defect-type triage control (run detail) + overview failure/defect widgets
- [x] Request Builder is Insomnia/Postman-like: saved-requests sidebar, load/edit, Save/Update, Delete, and Schedule-from-builder
- [x] Scenario Catalog enhanced: summary stats, header-based backend filters/search/sort, app column, Added at column; Scenario Detail shows target app it calls + **reflected Python source code** + assertions
- [x] Backend: DELETE /api/request-tests/{id} (cascades runs/schedules/revisions); enriched test detail via reflection (inspect.getsource)
- [ ] Customizable dashboards (react-grid-layout) — Overview is fixed for now

## Tests (automated)
- [x] 22 example code automation tests in `tests/automations/api/` (self-tests: methods, status codes, headers, JSON body, regex, redirect, basic auth, timing) — all discovered and passing
- [~] Backend unit/integration test suite (pytest) for services, recurrence, assertions, queue
- [ ] Frontend component/E2E tests

## Docs
- [x] `architecture.md`, `implementation_plan.md` updated (Testkube+ReportPortal framing, targets, cleanup hook, docs tab)
- [x] `docs/TODO.md` (this file)
- [x] Root `README.md` with quickstart (`docker compose up`, URLs, admin/admin)

## Next increment — multi-step tests, target observability, backend-driven tables
- [x] Multi-step UI request tests (`config.steps[]`) with sequential execution, per-step assertions, captures, and single-request backward compatibility
- [x] Automatic code-test discovery by recursively scanning `backend/tests/automations/` for `BaseAutomationTest` subclasses; no manual module registration
- [x] Backend pagination/search/filter/sort contract for table endpoints (scenarios, runs, targets, target detail tests/runs, schedules done; workers and remaining linked tables reviewed and verified)
- [x] Target detail API + `/targets/{id}` page with target metadata, tests, runs, pass/fail ratio, charts, and failure information
- [x] React Flow step visualization on `/scenarios/{id}` with run-context coloring from `?runId=...` (`/tests/{id}` redirects for compatibility)
- [x] Overview enrichment, including clickable Recent Failures rows that route to the failed test detail page
- [x] Request Builder Flow mode for add/duplicate/reorder/delete steps, captures, send-flow results, save/update/schedule
- [x] Developer Docs rebuilt as a comprehensive developer guide, with Fumadocs UI components and sticky left/right documentation columns
- [x] Sticky sidebar/app shell: sidebar remains fixed/sticky while the page content scrolls
- [x] AntD table-header backend filters/search/sort on Scenarios, Runs, Targets, Schedules, and Overview dashboard tables; external filter rows removed from those list pages
- [x] Runs page backend-driven filtering/search/sorting for status, trigger, target, defect type, failure category, and test name/key
- [x] Reusable user tags for tests, created on demand and suggested for reuse
- [x] Test detail comments with optional tags
- [x] Run detail comments with optional tags
- [x] Backend tracing spans for run execution, flow execution, HTTP steps, discovery, target stats, comments, and tags
- [x] `/runs/{id}` has an `Open scenario` shortcut to `/scenarios/{id}`
- [x] `/schedules` can create schedules with multiple scenarios; `/schedules/{id}` lists all included scenarios and recent runs for the shared schedule
- [x] Add the requested qtp_self scenario suites in `backend/scenarios/automation/qtp_self/`: 10 each for `CliTest`, `PlaywrightTest`, `SeleniumTest`, and `PythonTest`
- [x] Update the worker image/runtime dependencies for Playwright and Selenium workloads

---

# UI/UX Enterprise Migration Progress

Tracks execution of **docs/migrate_UI.md** (Linear/Datadog/Jira-grade overhaul).
Baseline screenshots: `docs/screenshots/` · after-state: `docs/screenshots/after/`.
Decisions (§12): indigo accent · neutral near-black dark · rounded-rect status
badges · Inter + JetBrains Mono · cmdk · themed static charts (Tier A) · fumadocs
Option A. Verified by building on Vite dev (5173) + Playwright screenshots.

_Last updated: 2026-07-10._

## Phase 0 — Foundation (design tokens) ✅ done
- [x] `theme/tokens.ts` — single source of truth (indigo brand, near-black dark, unified status palette, shadow/radius/type scale)
- [x] `theme/antdTheme.ts` — AntD ConfigProvider from tokens (13px base, 34px controls, flat elevation)
- [x] `theme/cssVars.ts` + `applyCssVars` — CSS custom properties on `<html>` from tokens
- [x] `theme/chartTheme.ts` — ECharts themes (`qtp-light`/`qtp-dark`) from tokens; one green/red across charts + badges
- [x] `theme/mode.ts` — `ModeContext`/`useMode` so charts/badges react to theme
- [x] Ship the typeface: `@fontsource-variable/inter` + `@fontsource/jetbrains-mono` loaded in `main.tsx` (was declared but never loaded)
- [x] `index.css` — token-synced `:root` vars (light+dark), indigo logo/accent, visible focus rings, `tabular-nums`, lighter shadows
- [x] Wire into `QtpApp.tsx` (buildAntdTheme + applyCssVars + ModeContext)

## Phase 1 — App shell & navigation ✅ done
- [x] `components/PageHeader.tsx` — breadcrumb + single title + subtitle + actions slot
- [x] App-bar shows route-derived breadcrumb (group › page); removed the bold duplicate title/meta block
- [x] Killed duplicate titles on: Overview, Runs, Scenarios, Schedules, Targets, Workers, Audit, Run detail
- [x] Run detail leads with `Runs / <entity>` breadcrumb + inline status badge + action slot (no back-button clutter)
- [x] Scenarios: removed the two oversized "Matching tests / Current page" cards (count moved into the header subtitle)

## Phase 2 — Data-display primitives 🟡 in progress
- [x] Themed ECharts applied to Overview (trend/defect/target charts, light+dark)
- [x] `components/EmptyState.tsx` + global `renderEmpty` — replaces AntD gray-printer illustrations; Overview empties themed
- [x] **Debounced auto-search** (~350ms/keystroke) on all column search filters (`remoteTable.textFilter/textFilterLocal`) and the Audit search box + column filters — no Search-button/Enter needed
- [ ] `components/StatusBadge.tsx` — one rounded-rect + dot badge; migrate `StatusTag`/`DefectTag` + ad-hoc AntD `Tag` usages (Cleanup, assertions ✓/✗, Audit actions)
- [ ] `components/DataTable.tsx` — single-line rows (ellipsis+tooltip), hover-revealed row actions, density toggle, skeleton rows
- [ ] `components/MetricTile.tsx` — Overview KPI hierarchy (primary strip + sparkline + delta vs previous window)
- [ ] `components/FilterBar.tsx` — active-filter chips + unified search (§6.2)
- [ ] `components/ChartCard.tsx` + `Section.tsx` + `Callout.tsx` primitives

## Phase 3 — Page-by-page ⬜ not started (detail pages still show `Typography.Title level={3}`)
- [ ] Detail pages → PageHeader + breadcrumb: ScenarioDetail, ScheduleDetail, TargetDetail, WorkerDetail, AuditEntity
- [ ] `ExecutionFlow.tsx` — tokenize node/edge/canvas colors (currently hardcoded light hex → breaks dark mode)
- [ ] Run detail AI-analysis / cleanup / trace callouts → token-driven `<Callout>` (hardcoded `#fff2f0`/`#91caff` break dark)
- [ ] Token-ize remaining hardcoded hex across `pages/`+`components/` (was 177 occurrences; target 0)

## Phase 4 — High-friction surfaces (deep dives) ⬜ not started
- [ ] §2.3 Comments → `<Discussion>` (markdown, @mentions, edit/delete, resolve state, optimistic insert; tokenize avatar palette)
- [ ] §2.4 Request Builder → shared `<ResponseViewer>` (highlighted body + JSON tree + raw/pretty + copy, no 5k truncation); implement Headers tab; `<ParamsTable>` with enable toggles; method colors off the status ramp; Environments; Copy as cURL
- [ ] §2.5 Docs → fumadocs Option A (MDX + search), tokenized; retire hand-rolled `.qtp-docs-*`
- [ ] §2.6 Audit → event-stream layout + field-level `ValueDiff` (drop raw-JSON `#fafafa` expand); correlation grouping; one navigation

## Phase 5 — Power & polish ⬜ not started
- [ ] `CommandPalette.tsx` on `cmdk` (⌘K) + global keyboard shortcuts
- [ ] Skeletons, toasts standardization, a11y pass (focus/aria/contrast), reduced-motion

## Notes / follow-ups
- Auto-search delay is 350ms; tune if it feels slow/fast.
- `PAGE_META` in `QtpApp.tsx` now unused (breadcrumb derives from NAV) — remove in a cleanup pass.
- Non-nav routes (`/profile`) fall back to the "Overview" breadcrumb in the app bar — add a route→crumb map.
