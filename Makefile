# QTP — Quality Testing Platform
#
# Convenience wrapper around the real commands (docker compose, gunicorn, npm,
# pytest). Run `make` or `make help` for the target list.
#
# Override any variable on the CLI, e.g.  make up COMPOSE="docker-compose"

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

# ── Help ─────────────────────────────────────────────────────────────────
.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"} \
		/^##@/ {printf "\n\033[1m%s\033[0m\n", substr($$0, 5); next} \
		/^[a-zA-Z0-9_.-]+:.*##/ {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' \
		$(MAKEFILE_LIST)
	@echo ""

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
