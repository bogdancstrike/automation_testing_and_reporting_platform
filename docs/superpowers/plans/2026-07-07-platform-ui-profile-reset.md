# Platform UI Profile Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved shell redesign, dark mode, profile page, target stats soft reset, Test Catalog `Added at` column, and expanded automation scenario coverage.

**Architecture:** Keep Ant Design and the current Flask/SQLAlchemy route-map architecture. Add one target reset endpoint, one execution soft-reset model extension, theme-aware frontend app shell state, and scenario classes discovered by the existing code-test registry.

**Tech Stack:** React 18, Vite, Ant Design 5, TanStack Query, TypeScript, Flask-style route handlers through `backend/maps/endpoint.json`, SQLAlchemy ORM, pytest.

---

### Task 1: App Shell And Theme

**Files:**
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/QtpApp.tsx`
- Modify: `frontend/src/index.css`

- [ ] Move Ant Design theme ownership into `QtpApp` so dark mode state can switch `theme.defaultAlgorithm` and `theme.darkAlgorithm`.
- [ ] Persist theme mode in `localStorage` under `qtp-theme-mode`.
- [ ] Replace the flat sidebar items with grouped menu sections ordered as Monitor, Test Design, Assets, Knowledge.
- [ ] Add a header dark mode icon button and route the user menu profile item to `/profile`.
- [ ] Add theme-aware shell classes and CSS variables for content backgrounds, cards, code blocks, sidebar section labels, and header borders.

### Task 2: Profile Page

**Files:**
- Create: `frontend/src/pages/ProfilePage.tsx`
- Modify: `frontend/src/QtpApp.tsx`
- Modify: `frontend/src/api/types.ts`

- [ ] Create `/profile` route.
- [ ] Show username, email, subject, roles, and admin/operator flags from `qtp.me`.
- [ ] Query recent runs with `{ page: 1, page_size: 8, sort: "queued_at", order: "desc" }`.
- [ ] Render recent executions with status, test name, target, duration, and queued time.

### Task 3: Target Stats Soft Reset

**Files:**
- Modify: `backend/src/execution/models.py`
- Modify: `backend/src/execution/service.py`
- Modify: `backend/src/execution/serializers.py`
- Modify: `backend/src/catalog/service.py`
- Modify: `backend/src/api/targets.py`
- Modify: `backend/src/reporting/service.py`
- Modify: `backend/maps/endpoint.json`
- Modify: `frontend/src/api/qtp.ts`
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/pages/TargetDetailPage.tsx`

- [ ] Add reset metadata fields to `TestRun`.
- [ ] Add reusable filters that exclude reset rows from user-facing run queries and aggregates.
- [ ] Add a service function that marks all target runs as reset and marks their active queue items done.
- [ ] Add `POST /api/targets/<target_id>/reset-stats` requiring operator role.
- [ ] Add frontend mutation with two confirmation modals and invalidate target/run/dashboard queries after success.

### Task 4: Test Catalog Added At

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/pages/CatalogPage.tsx`

- [ ] Add `created_at` and `updated_at` to `TestDef`.
- [ ] Add sortable `Added at` column using `created_at`.

### Task 5: Scenario Expansion

**Files:**
- Create: new or grouped scenario modules under `backend/scenarios/automation/qtp_self`
- Create: new or grouped scenario modules under `backend/scenarios/automation/qtp_self`

- [ ] Add at least 30 qtp_self scenario classes across health, auth, catalog, targets, runs, schedules, filters, and multi-step dependent flows.
- [ ] Add at least 20 qtp_self scenario classes across status, headers, redirects, auth, cookies, payloads, delay, cache, and dependent captures.
- [ ] Keep scenario metadata keys unique and target keys aligned with seeded targets: `qtp_self` and `demo`.

### Task 6: Verification And Checkpoints

**Files:**
- Verify changed files only.

- [ ] Run `npm run build` from `frontend`.
- [ ] Run available backend tests with `pytest` from `backend` if local dependencies and database are available.
- [ ] Run `git status --short`, commit stable checkpoints, and push `master` to `origin` after each checkpoint.
