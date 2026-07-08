# Developer Docs Scenarios Schedules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver comprehensive developer docs, `/scenarios` routing, backend-driven table header filters, multi-scenario schedules, run-detail scenario navigation, and expanded worker/scenario support.

**Architecture:** Keep the current Vite/React/Ant Design SPA and Flask/SQLAlchemy backend structure. Add focused backend schema/service changes for schedule-to-test associations, reusable frontend table helpers for remote filters, and browser-capable worker image dependencies.

**Tech Stack:** React 18, Vite, React Router, Ant Design 5, TanStack Query, TypeScript, SQLAlchemy, Flask-style route handlers, PostgreSQL, Docker, Playwright, Selenium.

---

### Task 1: Route Names And Run Shortcut

**Files:**
- Modify: `frontend/src/QtpApp.tsx`
- Modify: `frontend/src/pages/RunDetailPage.tsx`
- Modify: `frontend/src/pages/TestDetailPage.tsx`
- Modify: `frontend/src/pages/TargetDetailPage.tsx`
- Modify: `frontend/src/pages/ScheduleDetailPage.tsx`
- Modify: `frontend/src/pages/CatalogPage.tsx`

- [ ] Add `/overview`, `/scenarios`, and `/scenarios/:id` routes.
- [ ] Redirect `/` to `/overview`, `/tests` to `/scenarios`, and `/tests/:id` to `/scenarios/:id`.
- [ ] Rename sidebar item from Test Catalog to Scenarios.
- [ ] Update frontend navigation links to scenario details.
- [ ] Add `Open scenario` button to `/runs/{id}`.
- [ ] Run `npm run build`, commit, and push.

### Task 2: Developer Docs

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Replace or refactor: `frontend/src/pages/DocsPage.tsx`
- Modify: `frontend/src/index.css`

- [ ] Evaluate installing Fumadocs packages in the current SPA.
- [ ] Build Fumadocs-style docs shell with left nav, article content, sticky right TOC, callouts, cards, and code blocks.
- [ ] Expand content for developer users: concepts, authoring, scenario types, assertions, captures, schedules, execution, CI, integration, and troubleshooting.
- [ ] Ensure the right TOC column is sticky while the docs article scrolls.
- [ ] Run `npm run build`, commit, and push.

### Task 3: Remote Header Table Filters

**Files:**
- Create: `frontend/src/components/remoteTable.tsx`
- Modify: `frontend/src/pages/CatalogPage.tsx`
- Modify: `frontend/src/pages/RunsPage.tsx`
- Modify: `frontend/src/pages/SchedulesPage.tsx`
- Modify: `frontend/src/pages/TargetsPage.tsx`
- Modify: `frontend/src/pages/OverviewPage.tsx`
- Modify backend services where missing query fields are needed.

- [ ] Create reusable text/select filter dropdown helpers for Ant Design tables.
- [ ] Move external filters into table headers.
- [ ] Preserve backend-driven pagination, sort, and filters.
- [ ] Add backend params for overview drill-down tables where needed.
- [ ] Run build/compile checks, commit, and push.

### Task 4: Multi-Scenario Schedules

**Files:**
- Modify: `backend/src/scheduling/models.py`
- Modify: `backend/src/scheduling/service.py`
- Modify: `backend/src/scheduling/serializers.py`
- Add migration under `backend/migrations/versions/`
- Modify: `backend/scripts/init_db.py`
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/pages/SchedulesPage.tsx`
- Modify: `frontend/src/pages/ScheduleDetailPage.tsx`

- [ ] Add schedule-to-test association model/table.
- [ ] Accept `scenario_ids` for create/update while preserving single-test compatibility.
- [ ] Serialize all scheduled scenarios.
- [ ] Enqueue one run per associated scenario on each due schedule.
- [ ] Update schedule list/detail UI to show scenario counts and all scenarios.
- [ ] Run compile/build checks, commit, and push.

### Task 5: Scenario Types And Worker Image

**Files:**
- Add scenario modules under `backend/scenarios/automation/qtp_self/`
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `backend/requirements.txt`

- [ ] Add 10 `CliTest` qtp_self scenarios.
- [ ] Add 10 `PythonTest` qtp_self scenarios.
- [ ] Add 10 `PlaywrightTest` qtp_self scenarios.
- [ ] Add 10 `SeleniumTest` qtp_self scenarios.
- [ ] Install Playwright/Selenium runtime dependencies in the worker image.
- [ ] Add worker capabilities for `cli`, `playwright`, and `selenium`.
- [ ] Run discovery count and Python compile checks, commit, and push.

### Task 6: Final Verification

**Files:**
- Verify changed files only.

- [ ] Run `npm run build` from `frontend`.
- [ ] Run `python3 -m compileall backend/src backend/scripts backend/scenarios/automation worker`.
- [ ] Run scenario discovery count.
- [ ] Run available pytest tests or document dependency/service blockers.
- [ ] Confirm `git status --short` is clean.
- [ ] Start frontend dev server and report URL.
