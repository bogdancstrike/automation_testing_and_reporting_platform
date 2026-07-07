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

1. **Code-based scenarios** written in Python — one file per test under
   `backend/scenarios/automation/<target>/`, in an imperative fluent style
   (`ctx.http.get(...).should.have_status(200)`, `with ctx.step(...)`), covering
   HTTP, CLI/container, browser (Playwright), and free-form Python. Auto-discovered
   from the repo by target directory.
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

That builds and starts the whole stack: PostgreSQL 17, Kafka + Kafka UI, Redis,
Jaeger, Keycloak 26.1 (realm auto-imported), a demo target (httpbin), the backend
(API + scheduler), 3 execution workers, and the frontend. The `init` service
creates the schema, the `qtp-workers` topic, and seeds a project, targets, the
example scenarios (single- and multi-step, across the `qtp_self` and `httpbin`
targets), a schedule, and one run.

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

QTP is a **modulith with two entrypoints** (one image, one shared `backend/src`):
a **backend** (API + scheduler) and a **worker**, scaled independently. Both run
under `gunicorn -k gevent` (async greenlets, no OS threads). Runs are dispatched
to workers over **Kafka**, not a DB poll: the backend publishes one message per
enqueued run (just the run id) to topic `qtp-workers` (10 partitions), and the
worker consumer group splits the partitions across replicas.

```
Browser (React + Ant Design, Keycloak login)
   │  JSON API, JWT bearer
   ▼
Backend  (gunicorn+gevent; Flask + QF FrameworkApp under /qtp)
   ├─ API            (definitions, targets, schedules, runs, logs, metrics)
   ├─ Scheduler      (greenlet, pg advisory-lock; enqueues due schedules)
   └─ Kafka producer (publishes run_id → topic "qtp-workers", keyed by run_id)
        │
        ▼  Kafka (10 partitions, consumer group "qtp-workers")
Worker × N (gunicorn+gevent; QF ETL @kafka_handler)
   └─ consumes run_id → loads the run from Postgres → runs the adapter →
      persists results   (partitions split across replicas = horizontal scale)

PostgreSQL = run-state source of truth · Redis = QF ETL runtime · Jaeger = traces
Target apps under test (addressed by URL; demo = httpbin)
```

The backend **produces** run ids to Kafka; each run id lands on one partition, so
exactly one worker in the group executes it (that delivery is the "claim"). The
worker fetches the full test/revision/target from Postgres by id and writes the
outcome back — only the id travels through Kafka.

Auth is Keycloak (OIDC). The API verifies JWTs against Keycloak's JWKS; in
Docker it fetches keys internally (`http://keycloak:8080`) while validating the
issuer the browser used (`http://localhost:8080`).

### Scaling

```bash
docker compose up -d --build          # backend×1, worker×3 (default replicas)
docker compose up -d --scale worker=6 # more consumers → Kafka rebalances the 10 partitions
```

Backend scales via `GUNICORN_WORKERS` / replicas; the scheduler stays single-active
across all of them via a Postgres advisory lock. Workers scale via `replicas`
(or `GUNICORN_WORKERS`); the shared `qtp-workers` consumer group spreads the 10
partitions across them. Inspect topics/partitions/consumer-group lag in **Kafka UI**
(http://localhost:8081) and traces in **Jaeger** (http://localhost:16686).

## Local development (without Docker)

Backend:

```bash
cd backend
python3 -m venv .venv && ./.venv/bin/pip install dist/qf-1.0.2-py3-none-any.whl -r requirements.txt
# point DATABASE_URL / KAFKA_BOOTSTRAP_SERVERS / REDIS_* / KEYCLOAK_* at your services (see .env.example)
./.venv/bin/python scripts/init_db.py                             # tables + seed + create runs topic
./.venv/bin/gunicorn -c gunicorn.conf.py wsgi:app                 # backend: API + scheduler (greenlet)

# worker: a separate entrypoint of the same modulith (imports backend/src)
cd ../worker
PYTHONPATH=../backend ../backend/.venv/bin/gunicorn -c gunicorn.conf.py wsgi:app
```

Needs a Kafka broker and Redis reachable (the worker is a QF ETL Kafka consumer
and the QF ETL runtime uses Redis). Set `AUTH_DISABLED=true` to bypass Keycloak
with a synthetic admin for quick API smoke tests.

Frontend:

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Adding a test

- **In Python (a scenario)**: add one file `backend/scenarios/automation/<target>/<name>.py`
  (one class per file, organized by target). Subclass `HttpTest` (or `CliTest` / `PythonTest`
  / `PlaywrightTest`), declare `TestMetadata`, and write an imperative `test(self, ctx)` with
  fluent assertions. No registration step — dropping a file in a target directory (or adding a
  new target directory) is auto-discovered (Catalog → "Discover code tests"). See
  `backend/scenarios/automation/qtp_self/` and `.../httpbin/` for worked single- and
  multi-step examples.

  ```python
  from src.testkit import HttpTest, TestMetadata, TYPE_HTTP

  class SelfHealth(HttpTest):
      metadata = TestMetadata(key="self.health", name="QTP · health returns ok",
                              type=TYPE_HTTP, tags=["self", "health"], owner="admin",
                              target="qtp_self")

      def test(self, ctx):
          response = ctx.http.get("/health")
          response.should.have_status(200)
          response.should.respond_within_ms(3000)
          response.json.should.have_field("status").equal_to("ok")
  ```

  Multi-step flows group actions with `with ctx.step("...")` and pass data between steps
  (capture an id from one response, use it in the next). `ctx.cli.run(...)` runs a
  command/container CLI (Testkube-style); `ctx.browser.visit(...)` drives Playwright (needs a
  browser-equipped worker image).

- **From the UI**: open Request Builder, configure the request and assertions,
  Send to try it, Save to keep it.

Full walkthrough with snippets is in the app under **Developer Docs**.

## Ports

| Port | Service |
| --- | --- |
| 5173 | Frontend (nginx) |
| 5100 | Backend API |
| 8080 | Keycloak |
| 8081 | Kafka UI |
| 8088 | Demo target (httpbin) |
| 9094 | Kafka (host/external listener) |
| 6379 | Redis |
| 16686 | Jaeger UI |
| 4317 | OTLP gRPC (traces) |
| 5432 | PostgreSQL |
