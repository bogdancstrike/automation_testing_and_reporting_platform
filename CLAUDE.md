# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

QTP (QSINT Testing Platform) merges two ideas into one modulith: **Testkube-style
execution** (test definitions, schedules, a durable PostgreSQL run queue, capability-aware
workers) and **ReportPortal-style reporting** (run history, dashboards, failure-signature
grouping, defect-type triage). It tests **any target application by URL** — never itself
by assumption, though it does include self-tests as one target among many.

Tests are authored two ways, both resolving a target by URL rather than hardcoding one:
1. **Code-based tests** — Python subclasses of `BaseAutomationTest` under
   `backend/tests/automations/`, auto-discovered recursively.
2. **UI request tests** — built in a Postman-like Request Builder, asserting on response
   body/headers/timing, not just status code.

Full design: `docs/architecture.md` (read this before any non-trivial backend change —
it documents 23 sections including domain model, execution lifecycle, assertion model,
and security requirements). Implemented-vs-remaining status: `docs/TODO.md` — keep it
updated as work lands. `README.md` has the docker-compose quickstart and port table.

## Commands

### Run the full stack
```bash
docker compose up -d --build
docker compose up -d --scale worker=6   # more Kafka consumers → partitions rebalance
```
Brings up postgres 17, Kafka (KRaft) + kafka-ui, Redis, Jaeger, Keycloak 26.1, httpbin,
`init` (schema + seed + creates the 10-partition `qtp-workers` topic, runs once), `api`
(backend: API + scheduler), 3 `worker` replicas, `frontend`. UI: `:5173` (admin/admin),
API: `:5100/qtp`, Keycloak: `:8080`, Kafka UI: `:8081`, Jaeger: `:16686`.

### Backend, without Docker
```bash
cd backend
python3 -m venv .venv && ./.venv/bin/pip install dist/qf-1.0.2-py3-none-any.whl -r requirements.txt
# needs Postgres + Kafka + Redis reachable (see backend/.env.example)
./.venv/bin/python scripts/init_db.py                   # tables + seed + create runs topic
./.venv/bin/gunicorn -c gunicorn.conf.py wsgi:app       # backend: API + scheduler greenlet
# worker is a separate entrypoint of the same modulith (imports backend/src):
cd ../worker && PYTHONPATH=../backend ../backend/.venv/bin/gunicorn -c gunicorn.conf.py wsgi:app
```
Both apps run under `gunicorn -k gevent` (config in each dir's `gunicorn.conf.py`).
`python main.py` in either dir is a dev fallback (no gunicorn). Set `AUTH_DISABLED=true`
in `.env` to bypass Keycloak with a synthetic admin; for CI/curl, the hardcoded bearer
`system-bearer-token` also resolves to the synthetic admin (`src/iam/decorators.py`).

### Backend tests
```bash
cd backend
./.venv/bin/pytest tests/unit                 # pure unit tests, no external services
./.venv/bin/pytest tests/integration           # needs a real Postgres reachable at
                                                # postgresql+psycopg2://qtp:qtp@localhost:5432/qtp
                                                # (drops and recreates all tables each run)
./.venv/bin/pytest tests/unit/test_unit.py::test_compute_next_cron   # single test
```
There's no `pytest.ini`/`pyproject.toml` — pytest runs with defaults from `backend/`.
Note: `tests/automations/` are QTP's *product* tests (discovered and run by the platform
itself, not by pytest) — don't confuse them with `tests/unit` and `tests/integration`,
which are pytest suites covering QTP's own backend code.

### Frontend
```bash
cd frontend
npm install
npm run dev       # http://localhost:5173, expects the API reachable per src/config.ts
npm run build      # tsc + vite build
npm run preview
```
No lint script and no test runner configured in `package.json` currently.

## Architecture

### QF framework integration — non-obvious, load-bearing constraints

The backend is built on a local wheel (`backend/dist/qf-1.0.2-py3-none-any.whl`, import
package `framework`) that hard-codes several behaviors. These are verified from the wheel
source (see `docs/architecture.md` §4), not stylistic choices:

- `framework.api.server.create_app` calls `app.config.from_object('config.Config')`, and
  the ETL import chain does `from config import Config` — both require a **top-level**
  importable `config` module. `backend/config.py` is a thin shim re-exporting
  `src/config.py:Config`; it must stay at the repo root, not move into `src/`.
- `FrameworkSettings.enable_etl` defaults `True`; `FrameworkApp.run()` calls `start_etl()`,
  which raises `RuntimeError` without Kafka. `main.py` always constructs
  `FrameworkSettings(enable_etl=False, ...)`.
- `FrameworkApp.run()` **does not bind an HTTP server** — it only registers endpoints and
  returns handles. `main.py` calls `handles.app.run(...)` itself.
- QF ships **no auth** ("security is the responsibility of the deployment environment")
  but bundles `flask-jwt-extended`/`flask-bcrypt`/`flask-talisman`/`flask-cors` as
  transitive deps. QTP owns auth end-to-end via Keycloak, wired through
  `FrameworkSettings.init_app`.
- Dynamic endpoints declared in `backend/maps/endpoint.json` dispatch to handlers shaped
  `def handler(app, operation, request, **kwargs)` — `operation` is the operation name
  string, path params arrive as kwargs. `endpoint.json` requires `namespaces`, `models`,
  and `endpoints[{namespace, operation_name, model_name, request_method[], api_url,
  exec_method:{module_name, method_name}}]`. Give bodyless endpoints (e.g. DELETE) a null
  `model_name` or QF demands a validated request body.

### Backend module layout (`backend/src/`)

Dependency direction is one-way: `core` → `iam`/`testkit` → domain modules
(`catalog`, `execution`, `scheduling`, `reporting`, `audit`, `comments`) → `api`
(composition layer) → `workers` (process entrypoints).

- `core/` — `db.py` (engine/session_scope), `errors.py` (`QtpError` subclasses that
  handlers turn into `(body, status)` tuples), `correlation.py`, `clock.py`,
  `net_guard.py` (SSRF: resolves hostname, validates the **resolved IP**, pins the
  connection, re-checks on every redirect hop — required reading before touching the
  Request Builder's outbound path), `secrets.py`.
- `iam/` — Keycloak JWT verification (`token_verifier.py`, split public-issuer vs.
  internal-JWKS-fetch URLs since the API fetches JWKS via Docker-internal DNS but must
  validate the issuer claim the browser actually used), `principal.py`, and
  `decorators.py` (`@require_authenticated`, `@require_role(...)` — every handler in
  `api/` is wrapped by one of these; `AUTH_DISABLED=true` and the literal
  `system-bearer-token` bearer both short-circuit to `synthetic_admin()`).
- `testkit/` — the test framework SDK: `base.py` (`BaseAutomationTest`, lifecycle
  `validate_config → setup → execute → cleanup → teardown`, where `cleanup`/`teardown`
  always run even if `execute` raised), `context.py` (`TestContext`: target resolution,
  `{{var}}` templating, secret redaction, cancellation token), `assertions.py` (full
  operator taxonomy + minimal JSONPath), `registry.py` (discovery, recursively scans
  `backend/tests/automations/` for `BaseAutomationTest` subclasses — `Config
  .AUTOMATION_MODULES` explicit-list discovery is only a fallback for when the path scan
  finds nothing), `adapters/` (HTTP adapter is real; Playwright/Selenium/CLI adapters are
  stubbed to return a clear ERROR — not runnable in the demo image yet).
- `catalog/`, `execution/`, `scheduling/`, `reporting/`, `audit/`, `comments/` — one
  `models.py` + `service.py` (+ `serializers.py`) per domain. Services take a SQLAlchemy
  `Session` as their first argument and return plain dicts (already serialized) — handlers
  never leak ORM objects into responses.
- `api/` — one thin module per resource, each function decorated with
  `@require_authenticated` or `@require_role(ROLE_...)`, opening a `session_scope()` and
  delegating to a service function. Look at `src/api/tests.py` for the canonical shape.
- `core/kafka_bus.py` — the Kafka producer bus: `ensure_runs_topic()` (creates
  `qtp-workers` with `KAFKA_RUNS_PARTITIONS`=10) and `publish_run(run_id, capability)`.
  Publishing happens from the `session_scope` **commit boundary** (`db.py`): `enqueue_run`
  stashes `run.id` on `session.info["pending_runs"]` and it is published only after the
  transaction commits — a transactional outbox, so a worker never races an uncommitted run.
- `workers/` — `scheduler_worker.py` (`run_scheduler`, spawned as a greenlet by the backend
  `wsgi.py`; a `pg_try_advisory_lock` keeps it single-active across all gunicorn workers/
  replicas) and `execution_worker.py` (`run_liveness_loop`: registers the worker instance +
  heartbeats the `workers` table). The actual run executor is `worker/kafka_runner.py` (a
  top-level module, not under `src/`).

### Topology: modulith, two entrypoints, Kafka transport

One image, one shared `src/`, two entrypoints scaled independently — both run under
`gunicorn -k gevent` (async greenlets, **no OS threads**; scale via `-w`/replicas):
- **`backend/`** (`wsgi.py`) — API + scheduler(greenlet) + Kafka **producer**.
- **`worker/`** (`wsgi.py` + `kafka_runner.py`) — Kafka **consumer**; imports shared
  `backend/src` via `PYTHONPATH=/app/backend`. Every worker process joins consumer group
  `WORKER_NAME` (=`qtp-workers`), so the broker splits the 10 partitions across replicas.
  `WORKER_INSTANCE_ID` (hostname) is the per-container identity in the `workers` table.

Dispatch is Kafka, not a DB poll: `enqueue_run` writes the `TestRun` (queued) and publishes
just its id; the worker consumes the id, loads the run from Postgres, executes it via
`execute_run`, and writes results back. Redis is required — the QF ETL worker runtime
(`framework.etl`) uses it. See the `qtp-kafka-modulith-architecture` memory for the full
rationale and the QF-ETL/gevent gotchas (e.g. the `OffsetAndMetadata` monkeypatch in
`worker/wsgi.py`).

### Execution lifecycle

`queued → claimed → preparing → running → {passed | failed | error | timeout | canceled |
skipped}`. `failed` means the system worked but an assertion failed; `error` means
infra/setup/unexpected exception. A run is delivered to exactly one worker via its Kafka
partition (keyed by run id); the handler guards on terminal status for idempotency against
redelivery. Cancellation is cooperative via `TestContext.should_cancel()`; `reap_stale`
(run from the scheduler tick) marks runs of dead workers `error`/`worker_lost`.

### Frontend (`frontend/src/`)

Vite + React 18 + TypeScript + Ant Design 5, TanStack Query for server state, plain
`fetch`-based API client in `src/api/client.ts`/`qtp.ts`/`types.ts`, Keycloak login via
`keycloak-js` (`src/keycloak.ts`) attaching bearer tokens to every call. Pages live flat in
`src/pages/` (Overview, Catalog, RequestBuilder, Runs/RunDetail, Schedules/ScheduleDetail,
Targets/TargetDetail, Workers, Docs, TestDetail) — no nested route-group folders yet.
`src/config.ts` reads runtime config from `public/config.js` (allows the built nginx image
to point at a different API host without a rebuild). Flow/step visualizations
(multi-step request tests) use `@xyflow/react` + `dagre` for layout, see
`components/ExecutionFlow.tsx`.

### Adding a test (for when asked to add one, not as a standing instruction)

- **Code test**: subclass `BaseAutomationTest` under `backend/tests/automations/...`,
  declare `TestMetadata` (globally unique `key`), implement `execute` (+ optional
  `setup`/`cleanup`/`teardown`). No manual registration needed — discovery scans the path
  recursively; trigger it via `POST /api/tests/discover` or the Catalog page's "Discover
  code tests". Existing examples: `backend/tests/automations/api/` (~22 tests against the
  platform's own health endpoints and the httpbin demo target).
- **UI request test**: Request Builder page → configure method/URL/headers/body/
  assertions → Send to try unsaved → Save as Test. Config is stored as JSONB on
  `test_revisions`; hot-queried fields are projected into `request_test_specs`.

### Security note specific to this codebase

The Request Builder lets users call arbitrary URLs by design, so `core/net_guard.py`'s
SSRF controls (resolved-IP validation, per-redirect-hop re-check, private/loopback/
link-local/metadata-IP blocking, project allowlist) are load-bearing, not optional
hardening. Any change that touches outbound HTTP execution (`testkit/adapters/http.py`,
request builder send/save paths) must keep every call routed through `net_guard`.
