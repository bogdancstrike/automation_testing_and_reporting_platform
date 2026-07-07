# QSINT Testing Platform (QTP)

QTP is an automation **testing platform + test framework** for running,
scheduling, observing, and analyzing automated tests against **any target
application**. It combines two ideas that usually live in two separate tools:

- **Testkube-style execution** — a control plane that owns test definitions,
  schedules, a durable PostgreSQL run queue, and workers that execute tests
  (HTTP today; Playwright/Selenium/CLI adapters are pluggable).
- **ReportPortal-style reporting** — a centralized store of every run with
  history, dashboards, failure grouping (signatures), and defect-type triage.

Tests are authored two ways, both pointing at an app **by URL**:

1. **Code-based tests** written in Python with the QTP framework (a common base
   class, lifecycle hooks, target resolution, assertions), discovered from the
   repo.
2. **UI request tests** built in a Postman-like builder that assert on the
   **response body, headers, and timing — not just the status code**, runnable
   on demand or on a schedule.

See `docs/architecture.md` and `docs/implementation_plan.md` for the full design,
and `docs/TODO.md` for implemented-vs-remaining status. The in-app **Developer
Docs** tab explains how to add and run tests with copy-pasteable snippets.

## Quick start

```bash
docker compose up -d --build
```

That builds and starts the whole stack: PostgreSQL 17, Keycloak 26.1 (realm
auto-imported), a demo target (httpbin), the API, an execution worker, the
scheduler, and the frontend. The `init` service creates the schema and seeds a
project, targets, ~22 example tests, a schedule, and one run.

Then open the UI and sign in:

| Thing | URL | Credentials |
| --- | --- | --- |
| **Web UI** | http://localhost:5173 | `admin` / `admin` |
| API | http://localhost:5100/qtp | Bearer token (Keycloak) |
| Keycloak admin console | http://localhost:8080 | `admin` / `admin` |
| Demo target (httpbin) | http://localhost:8088 | — |

> **The only application user is `admin` / `admin`** (Keycloak realm `qtp`, role
> `qtp_admin`, which implies every permission). The Keycloak *master* admin is
> also `admin` / `admin`. Change these before any non-local use.

### Get an API token (for curl/CI)

For local development or testing, you can obtain a standard token:

```bash
TOKEN=$(curl -s http://localhost:8080/realms/qtp/protocol/openid-connect/token \
  -d grant_type=password -d client_id=qtp-spa \
  -d username=admin -d password=admin | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

curl -s http://localhost:5100/qtp/api/tests -H "Authorization: Bearer $TOKEN"
```

**Note:** For CI pipelines and systems where interacting with IAM is difficult, the platform supports a hardcoded system bearer token `system-bearer-token` which bypasses standard IAM checks and automatically resolves to the `admin` user.
```bash
curl -s http://localhost:5100/qtp/api/tests -H "Authorization: Bearer system-bearer-token"
```

## What's in the box

- **Test Catalog** — all discovered code tests + saved UI tests; run any on demand.
- **Request Builder** — Postman-like; send an unsaved request, assert on the body,
  save as a managed test.
- **Runs / Run Detail** — live status, per-assertion results, response, logs,
  failure classification, and **defect-type triage**.
- **Schedules** — interval / cron / once recurrence.
- **Overview dashboard** — KPIs, run trend, defect distribution, per-target health.
- **Workers** — capability-aware execution status.
- **Developer Docs** — how to extend the platform.

The seeded examples include the platform **testing itself** (its own
`/health`, `/liveness`, `/readiness`, and that `/api/me` rejects anonymous
requests) plus a broad set against the httpbin demo target (methods, status
codes, headers, JSON body assertions, regex, redirects, basic auth, timing).

## Architecture (services)

```
Browser (React + Ant Design, Keycloak login)
   │  JSON API, JWT bearer
   ▼
API (Flask + QF FrameworkApp, dynamic endpoints under /qtp)
   ├─ PostgreSQL  (definitions, targets, schedules, queue, runs, logs, metrics)
   ├─ Worker      (claims queued runs FOR UPDATE SKIP LOCKED, runs adapters)
   └─ Scheduler   (enqueues due schedules; never executes tests)
Target apps under test (addressed by URL; demo = httpbin)
```

Auth is Keycloak (OIDC). The API verifies JWTs against Keycloak's JWKS; in
Docker it fetches keys internally (`http://keycloak:8080`) while validating the
issuer the browser used (`http://localhost:8080`).

## Local development (without Docker)

Backend:

```bash
cd backend
python3 -m venv .venv && ./.venv/bin/pip install dist/qf-1.0.2-py3-none-any.whl -r requirements.txt
# point DATABASE_URL / KEYCLOAK_* at your services (see .env.example)
./.venv/bin/python scripts/init_db.py      # create tables + seed
./.venv/bin/python main.py                 # API
./.venv/bin/python worker.py               # worker (separate shell)
./.venv/bin/python scheduler.py            # scheduler (separate shell)
```

Set `AUTH_DISABLED=true` to bypass Keycloak with a synthetic admin for quick
API smoke tests.

Frontend:

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Adding a test

- **In Python**: subclass `BaseAutomationTest` under `backend/tests/automations/`,
  declare `TestMetadata`, implement `execute` (and optionally
  `setup`/`cleanup`/`teardown`), add the module to `AUTOMATION_MODULES`, then run
  discovery (Catalog → “Discover code tests”). See `tests/automations/api/` for
  ~22 worked examples.
- **From the UI**: open Request Builder, configure the request and assertions,
  Send to try it, Save to keep it.

Full walkthrough with snippets is in the app under **Developer Docs**.

## Ports

| Port | Service |
| --- | --- |
| 5173 | Frontend (nginx) |
| 5100 | API |
| 8080 | Keycloak |
| 8088 | Demo target (httpbin) |
| 5432 | PostgreSQL |
