# QTP Implementation TODO

Living checklist of what is implemented vs. remaining. Reflects the code in
`backend/` and `frontend/`. See `architecture.md` and `implementation_plan.md`
for the full design.

_Last updated: 2026-07-07._

## Legend
- [x] done and verified
- [~] partial / simplified for the first runnable slice
- [ ] not started

## Infrastructure & deploy
- [x] `docker-compose.yml`: postgres 17, keycloak 26.1 (realm import), httpbin demo target, init, api, worker, scheduler, frontend
- [x] Backend `Dockerfile` (installs QF wheel + requirements)
- [x] Top-level `config.py` shim (QF requires importable `config.Config`)
- [x] Keycloak realm seed (`keycloak/realm-export.json`) — single `admin`/`admin` user with `qtp_admin`
- [x] DB init + seed (`backend/scripts/init_db.py`): project, demo target, discovery, sample UI test, schedule, one run
- [x] Frontend `Dockerfile` (nginx serving built SPA)
- [x] `.dockerignore` for backend/frontend build contexts
- [x] Alembic migrations (currently `create_all` at init; migrations dir still TODO)

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
- [~] CLI/Playwright/Selenium adapters — stubbed (return clear ERROR; not runnable in demo image)

## Backend — domain
- [x] Catalog: projects, targets, test definitions, revisions, discovery, UI request tests
- [x] Execution: queue (FOR UPDATE SKIP LOCKED, capability-aware), runner, lifecycle, steps/assertions/logs
- [x] Failure classification + failure signatures + defect-type auto-suggestion
- [x] Scheduling: once/interval/cron recurrence (croniter), due processing, CRUD
- [x] Reporting: overview (totals, pass/error rate, p50/p95, trend, per-target, backlog), failures, workers
- [x] Worker loop (register/claim/execute/heartbeat/reap-stale) + scheduler loop
- [~] Suites, result ingestion, materialized views — modeled in docs, not built yet
- [x] Cancellation of a *running* run (cooperative flag exists; queued-cancel works; running-cancel not fully exercised)

## Backend — verification (done locally against real Postgres + httpbin)
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
- [x] Pages: Overview, Test Catalog, Test Detail, Request Builder, Runs, Run Detail, Schedules, Targets, Workers
- [x] **Developer Docs tab** (architecture 17.1): author code tests, register, run on-demand/scheduled, assertion catalogue, API reference, snippets
- [x] Defect-type triage control (run detail) + overview failure/defect widgets
- [x] Request Builder is Insomnia/Postman-like: saved-requests sidebar, load/edit, Save/Update, Delete, and Schedule-from-builder
- [x] Test Catalog enhanced: summary stats, filters (type/source/target), app column; Test Detail shows target app it calls + **reflected Python source code** + assertions
- [x] Backend: DELETE /api/request-tests/{id} (cascades runs/schedules/revisions); enriched test detail via reflection (inspect.getsource)
- [ ] Customizable dashboards (react-grid-layout) — Overview is fixed for now

## Tests (automated)
- [x] 22 example code automation tests in `tests/automations/api/` (self-tests + httpbin: methods, status codes, headers, JSON body, regex, redirect, basic auth, timing) — all discovered and passing
- [~] Backend unit/integration test suite (pytest) for services, recurrence, assertions, queue
- [ ] Frontend component/E2E tests

## Docs
- [x] `architecture.md`, `implementation_plan.md` updated (Testkube+ReportPortal framing, targets, cleanup hook, docs tab)
- [x] `docs/TODO.md` (this file)
- [x] Root `README.md` with quickstart (`docker compose up`, URLs, admin/admin)

## Next increment — multi-step tests, target observability, backend-driven tables
- [x] Multi-step UI request tests (`config.steps[]`) with sequential execution, per-step assertions, captures, and single-request backward compatibility
- [x] Automatic code-test discovery by recursively scanning `backend/tests/automations/` for `BaseAutomationTest` subclasses; no manual module registration
- [x] Backend pagination/search/filter/sort contract for table endpoints (tests, runs, targets, target detail tests/runs, schedules done; workers and remaining linked tables reviewed and verified)
- [x] Target detail API + `/targets/{id}` page with target metadata, tests, runs, pass/fail ratio, charts, and failure information
- [x] React Flow step visualization on `/tests/{id}` with run-context coloring from `?runId=...`
- [x] Overview enrichment, including clickable Recent Failures rows that route to the failed test detail page
- [x] Request Builder Flow mode for add/duplicate/reorder/delete steps, captures, send-flow results, save/update/schedule
- [x] Developer Docs enrichment for multi-step tests, code-test auto-discovery, target pages, and backend-driven table APIs
- [x] Sticky sidebar/app shell: sidebar remains fixed/sticky while the page content scrolls
- [x] Runs page backend-driven filtering/search/sorting for status, trigger, target, defect type, failure category, and test name/key
- [x] Reusable user tags for tests, created on demand and suggested for reuse
- [x] Test detail comments with optional tags
- [x] Run detail comments with optional tags
- [x] Backend tracing spans for run execution, flow execution, HTTP steps, discovery, target stats, comments, and tags
- [ ] Keep this TODO updated as items move to done, partial, or deferred during the implementation
