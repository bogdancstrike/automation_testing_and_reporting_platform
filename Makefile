# ==============================================================================
# >>> USAGE GUIDE
#  QTP — Quality Testing Platform · Makefile
#
#  A thin, self-documenting wrapper over the real toolchain (docker compose,
#  gunicorn, npm, pytest). Every target maps to a command you could run by
#  hand — `make -n <target>` prints that command without executing it.
#
#    make            list all targets (same as `make help`)
#    make usage      reprint this guide
#
#  ----------------------------------------------------------------------------
#  QUICK START  (Docker — recommended)
#  ----------------------------------------------------------------------------
#    make up         build images + start the whole stack (detached)
#    make ps         check service status
#    make open       open the web UI (http://localhost:5173)
#    make logs       follow logs from all services (Ctrl-C to stop)
#    make down       stop & remove containers (Postgres/Keycloak data is kept)
#
#  First boot pulls images and runs DB init; give it a minute. The `init`
#  service creates the schema before `api` and `worker` start.
#
#  ----------------------------------------------------------------------------
#  SERVICE URLS & CREDENTIALS  (defaults)
#  ----------------------------------------------------------------------------
#    Web UI (frontend) ... http://localhost:5173     app login: admin / admin
#    API ................. http://localhost:5100/qtp/api
#    Keycloak ............ http://localhost:8080      admin / admin
#    Kafka UI ............ http://localhost:8081
#    Jaeger (traces) ..... http://localhost:16686
#    Postgres ............ localhost:5432   (user qtp / pass qtp / db qtp)
#    API system bearer ... system-bearer-token
#
#  ----------------------------------------------------------------------------
#  COMMON WORKFLOWS
#  ----------------------------------------------------------------------------
#  Rebuild after changing backend/worker code or requirements.txt:
#    make up                       rebuilds changed images and recreates them
#  Rebuild/replace a single service:
#    docker compose up -d --build api
#  Restart one service without rebuilding:
#    make restart-api   |   make restart-worker
#  Watch one service:
#    make logs-api   |   make logs-worker   |   make logs-frontend
#  Start fresh — DESTROYS all DB data, then rebuild:
#    make reset && make up
#  Re-run scenario discovery against the running API:
#    make discover
#  Get inside a container / the database:
#    make sh-api                   bash shell in the API container
#    make db-shell                 psql into Postgres (qtp / qtp)
#  Scale the worker pool (default 3 replicas):
#    docker compose up -d --scale worker=5
#
#  ----------------------------------------------------------------------------
#  LOCAL DEV  (run app processes on the host; keep infra in Docker)
#  ----------------------------------------------------------------------------
#  Needs Python 3.12 and Node 20. Infra (Postgres / Kafka / Keycloak) still runs
#  in Docker. Typical loop across three terminals:
#    make up                       once — bring the stack up (infra + all)
#    make backend-setup            once — create venv + install QF wheel & deps
#    make backend-run              terminal 1 — API (gunicorn) on :5100
#    make worker-run               terminal 2 — Kafka worker
#    make frontend-setup           once — npm install
#    make frontend-dev             terminal 3 — Vite dev server (HMR) on :5173
#
#  ----------------------------------------------------------------------------
#  TESTS & CHECKS
#  ----------------------------------------------------------------------------
#    make test                     backend pytest (after `make backend-setup`)
#    make test-unit                unit tests only
#    make test-integration         integration tests only
#    make frontend-typecheck       tsc --noEmit
#
#  ----------------------------------------------------------------------------
#  RAW SNIPPETS  (handy things the targets don't wrap)
#  ----------------------------------------------------------------------------
#  Trigger a scenario run and poll it to completion (CI-style gate):
#    RUN_ID=$(curl -fsS -X POST \
#      http://localhost:5100/qtp/api/scenarios/<scenario-key>/run \
#      -H "Authorization: Bearer system-bearer-token" | jq -r .id)
#    while :; do \
#      S=$(curl -fsS http://localhost:5100/qtp/api/runs/$RUN_ID \
#            -H "Authorization: Bearer system-bearer-token" | jq -r .status); \
#      echo "$S"; case "$S" in passed|failed|error|timeout|canceled) break;; esac; \
#      sleep 3; done
#  Filter logs to errors across the whole stack:
#    docker compose logs -f | grep -Ei "error|traceback|exception"
#
#  ----------------------------------------------------------------------------
#  CONFIG  (override on the CLI or via the environment)
#  ----------------------------------------------------------------------------
#    make up        COMPOSE="docker-compose"        use compose v1
#    make discover  API_BASE=http://host:5100/qtp BEARER=xyz
#    make backend-setup PYTHON=python3.12
#    Variables: COMPOSE PYTHON BACKEND_VENV QF_WHEEL API_BASE BEARER FRONTEND_URL
# <<< USAGE GUIDE
# ==============================================================================

# ── Config ───────────────────────────────────────────────────────────────
COMPOSE      ?= docker compose
PYTHON       ?= python3
BACKEND_VENV ?= backend/.venv
# QF_WHEEL path is relative to backend/ (that's where pip runs from).
QF_WHEEL     ?= dist/qf-1.0.5-py3-none-any.whl
API_BASE     ?= http://localhost:5100/qtp
BEARER       ?= system-bearer-token
FRONTEND_URL ?= http://localhost:5173

.DEFAULT_GOAL := help

# ── Help & usage ──────────────────────────────────────────────────────────
.PHONY: help usage guide
help: ## List every target (this screen)
	@awk 'BEGIN {FS = ":.*##"} \
		/^##@/ {printf "\n\033[1m%s\033[0m\n", substr($$0, 5); next} \
		/^[a-zA-Z0-9_.-]+:.*##/ {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' \
		$(MAKEFILE_LIST)
	@echo ""
	@echo "  Tip: 'make usage' prints a full guide — workflows, URLs & snippets."
	@echo ""

usage: ## Print the full usage guide (workflows, URLs, snippets)
	@sed -n '/^# >>> USAGE GUIDE/,/^# <<< USAGE GUIDE/p' $(firstword $(MAKEFILE_LIST)) \
		| grep -v 'USAGE GUIDE' \
		| sed 's/^# \{0,1\}//'

guide: usage ## Alias for usage

##@ Docker stack
.PHONY: up start stop down reset restart build ps
up: ## Build images and start the whole stack (detached)
	$(COMPOSE) up -d --build

start: ## Start the stack without rebuilding
	$(COMPOSE) up -d

stop: ## Stop containers but keep them (and their data)
	$(COMPOSE) stop

down: ## Stop and remove containers (volumes/data are kept)
	$(COMPOSE) down

reset: ## Remove containers AND volumes — WIPES Postgres/Keycloak data
	$(COMPOSE) down -v

restart: ## Restart all running services
	$(COMPOSE) restart

build: ## Build images without starting anything
	$(COMPOSE) build

ps: ## Show service status
	$(COMPOSE) ps

##@ Logs & containers
.PHONY: logs logs-api logs-worker logs-frontend restart-api restart-worker sh-api sh-worker
logs: ## Tail logs from every service
	$(COMPOSE) logs -f --tail=120

logs-api: ## Tail the API logs
	$(COMPOSE) logs -f --tail=120 api

logs-worker: ## Tail the worker logs (all replicas)
	$(COMPOSE) logs -f --tail=120 worker

logs-frontend: ## Tail the frontend (nginx) logs
	$(COMPOSE) logs -f --tail=120 frontend

restart-api: ## Restart just the API
	$(COMPOSE) restart api

restart-worker: ## Restart just the workers
	$(COMPOSE) restart worker

sh-api: ## Open a shell in the API container
	$(COMPOSE) exec api bash

sh-worker: ## Open a shell in a worker container
	$(COMPOSE) exec --index=1 worker bash

##@ Database
.PHONY: init-db db-shell
init-db: ## Create schema + seed data (runs scripts/init_db.py in a container)
	$(COMPOSE) run --rm init

db-shell: ## Open a psql shell on the Postgres container
	$(COMPOSE) exec postgres psql -U qtp -d qtp

##@ Backend (local, without Docker)
.PHONY: backend-setup backend-run worker-run
backend-setup: ## Create the venv and install the QF wheel + requirements
	$(PYTHON) -m venv $(BACKEND_VENV)
	cd backend && .venv/bin/pip install --upgrade pip
	cd backend && .venv/bin/pip install $(QF_WHEEL) -r requirements.txt

backend-run: ## Run the API locally (gunicorn + gevent)
	cd backend && .venv/bin/gunicorn -c gunicorn.conf.py wsgi:app

worker-run: ## Run a worker locally (consumes the Kafka queue)
	cd worker && PYTHONPATH=../backend ../backend/.venv/bin/gunicorn -c gunicorn.conf.py wsgi:app

##@ Frontend (local)
.PHONY: frontend-setup frontend-dev frontend-build frontend-typecheck
frontend-setup: ## Install npm dependencies
	cd frontend && npm install

frontend-dev: ## Start the Vite dev server (:5173)
	cd frontend && npm run dev

frontend-build: ## Build the production SPA bundle
	cd frontend && npm run build

frontend-typecheck: ## Type-check the frontend (tsc --noEmit)
	cd frontend && npx tsc --noEmit

##@ Tests
.PHONY: test test-unit test-integration
test: ## Run the full backend test suite
	cd backend && .venv/bin/pytest

test-unit: ## Run backend unit tests only
	cd backend && .venv/bin/pytest tests/unit

test-integration: ## Run backend integration tests only
	cd backend && .venv/bin/pytest tests/integration

##@ Utilities
.PHONY: discover open clean-pyc
discover: ## Trigger scenario discovery against the running API
	curl -fsS -X POST "$(API_BASE)/api/scenarios/discover" \
		-H "Authorization: Bearer $(BEARER)" | (jq . 2>/dev/null || cat)

open: ## Open the web UI in your browser
	@xdg-open "$(FRONTEND_URL)" 2>/dev/null || open "$(FRONTEND_URL)" 2>/dev/null || echo "Open $(FRONTEND_URL)"

clean-pyc: ## Remove Python __pycache__ and pytest caches
	find . -path ./.venv -prune -o -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -path ./.venv -prune -o -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
