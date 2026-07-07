# QTP Multi-Step Target Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add easy-to-author multi-step tests, automatic code-test discovery, backend-driven tables, target observability pages, React Flow step maps, and richer docs/UI.

**Architecture:** Extend the current modulith without introducing a separate workflow engine. QF usage guardrail: keep using QF dynamic endpoints/bootstrap/logging where useful, but keep domain behavior in plain service modules and do not add heavier QF/ETL/Kafka pieces for this increment. Horizontal scalability guardrails: API instances stay stateless, worker coordination stays in PostgreSQL queue/run rows, and new features persist shared state instead of storing it in process memory. The backend normalizes legacy single-request configs into step configs, executes steps through the existing HTTP adapter primitives, exposes paginated list envelopes, and adds target-focused aggregate endpoints. The frontend keeps the AntD operations-console style and adds reusable backend table/query helpers plus a React Flow test map.

**Tech Stack:** Python 3.12, Flask/QF, SQLAlchemy 2, PostgreSQL, requests, React 18, TypeScript, Ant Design 5, TanStack Query, ECharts, reactflow 11.11.4.

---

## File Structure

Modify backend files:

- `backend/src/comments/models.py`, `service.py`, `serializers.py`: new generic comments and reusable tag support for tests/runs.
- `backend/src/api/comments.py`, `tags.py`: new comment/tag endpoints.
- `backend/src/core/pagination.py`: new common parser/envelope/query helpers for page/page_size/q/sort/order.
- `backend/src/testkit/context.py`: add simple context variable helpers for captures.
- `backend/src/testkit/result.py`: optionally add `step_id`, `request`, and `response` fields to `StepResult` while preserving existing serializer output.
- `backend/src/testkit/registry.py`: add recursive discovery from `backend/tests/automations/` and keep `discover_classes(modules)` compatibility.
- `backend/src/testkit/adapters/http.py`: split single-step execution from multi-step flow execution; add captures.
- `backend/src/catalog/service.py`: normalize request configs, expose test steps, paginate/filter/sort tests, add target detail helpers.
- `backend/src/catalog/serializers.py`: serialize normalized steps and target summaries.
- `backend/src/execution/service.py`: paginate/filter/sort runs and support target filters.
- `backend/src/execution/serializers.py`: include step ids and per-step response summaries when available.
- `backend/src/reporting/service.py`: add target stats and `test_definition_id` in recent failures.
- `backend/src/scheduling/service.py`: paginate/filter/sort schedules.
- `backend/src/api/_helpers.py`: parse query params consistently.
- `backend/src/api/tests.py`, `runs.py`, `targets.py`, `schedules.py`, `dashboards.py`: return paginated envelopes and new endpoints.
- `backend/maps/endpoint.json`: add target detail/routes.
- `backend/scripts/init_db.py`: seed a multi-step UI request test.

Modify frontend files:

- `frontend/src/components/CommentsPanel.tsx`: shared comments UI for tests and runs.
- `frontend/src/components/TagEditor.tsx`: reusable tag editor with existing tag suggestions.
- `frontend/package.json` and `frontend/package-lock.json`: add `reactflow@11.11.4`.
- `frontend/src/api/types.ts`: add `Page<T>`, query types, step/capture/target-detail/stat types.
- `frontend/src/api/qtp.ts`: add paginated APIs, target detail APIs, and backward-compatible option-list helpers.
- `frontend/src/components/ServerTable.tsx`: new helper to map AntD table pagination/sort/search/filter to backend query params.
- `frontend/src/components/TestFlowGraph.tsx`: new React Flow visualization component.
- `frontend/src/pages/OverviewPage.tsx`: richer charts and clickable failures/targets.
- `frontend/src/pages/TargetsPage.tsx`: backend-driven table, row click to target page.
- `frontend/src/pages/TargetDetailPage.tsx`: new target observability page.
- `frontend/src/pages/TestDetailPage.tsx`: flow tab and run-context coloring from `?runId=`.
- `frontend/src/pages/RequestBuilderPage.tsx`: flow mode with steps/captures and send-flow results.
- `frontend/src/pages/CatalogPage.tsx`, `RunsPage.tsx`, `SchedulesPage.tsx`, `WorkersPage.tsx`: backend-driven table controls where applicable.
- `frontend/src/QtpApp.tsx`: route `/targets/:id` and make the sidebar sticky/fixed while main content scrolls.
- `frontend/src/pages/DocsPage.tsx`: enrich Developer Docs.
- `frontend/src/index.css`: visual polish and React Flow node styles.

Modify docs:

- `docs/TODO.md`: update after each completed milestone.
- `docs/superpowers/specs/2026-07-07-qtp-multistep-target-observability-design.md`: already updated with framework ergonomics.

---

### Task 1: Backend Pagination Contract

**Files:**
- Create: `backend/src/core/pagination.py`
- Modify: `backend/src/api/_helpers.py`
- Modify: `backend/src/catalog/service.py`
- Modify: `backend/src/execution/service.py`
- Modify: `backend/src/scheduling/service.py`
- Modify: `backend/src/api/tests.py`
- Modify: `backend/src/api/runs.py`
- Modify: `backend/src/api/targets.py`
- Modify: `backend/src/api/schedules.py`

- [ ] **Step 1: Add the pagination helper**

Create `backend/src/core/pagination.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from src.core.errors import ValidationError

@dataclass(frozen=True)
class PageParams:
    page: int = 1
    page_size: int = 20
    q: str = ""
    sort: str | None = None
    order: str = "asc"


def parse_page(args: dict[str, Any], *, default_sort: str | None = None, default_order: str = "asc") -> PageParams:
    page = max(int(args.get("page", 1) or 1), 1)
    page_size = min(max(int(args.get("page_size", 20) or 20), 1), 100)
    order = str(args.get("order", default_order) or default_order).lower()
    if order not in ("asc", "desc"):
        raise ValidationError("order must be asc or desc")
    return PageParams(page=page, page_size=page_size, q=str(args.get("q", "") or "").strip(), sort=args.get("sort") or default_sort, order=order)


def apply_sort(stmt: Select, sort: str | None, order: str, allowed: dict[str, Any]) -> Select:
    if not sort:
        return stmt
    col = allowed.get(sort)
    if col is None:
        raise ValidationError(f"unsupported sort field {sort!r}")
    return stmt.order_by(col.desc() if order == "desc" else col.asc())


def page_query(db: Session, stmt: Select, params: PageParams, *, serializer, default_total_from=None) -> dict[str, Any]:
    total_stmt = select(func.count()).select_from(default_total_from or stmt.order_by(None).subquery())
    total = int(db.scalar(total_stmt) or 0)
    rows = db.scalars(stmt.offset((params.page - 1) * params.page_size).limit(params.page_size)).all()
    return {"items": [serializer(r) for r in rows], "page": params.page, "page_size": params.page_size, "total": total, "sort": params.sort, "order": params.order}
```

- [ ] **Step 2: Convert service methods to page envelopes**

Change `list_tests`, `list_runs`, and `list_schedules` to return the envelope above. Keep filters (`type`, `source`, `target`, `status`, `trigger`, `test_definition_id`) and add `q`, `sort`, `order`.

- [ ] **Step 3: Keep option-list compatibility explicit**

Where the frontend needs all small option lists, add `page_size=100` calls rather than local filtering. Do not introduce hidden unpaginated table APIs.

- [ ] **Step 4: Run backend syntax checks**

Run:

```bash
cd backend && python3 -m compileall src
```

Expected: compileall succeeds.

- [ ] **Step 5: Update `docs/TODO.md`**

Mark backend pagination as `[~]` until all frontend tables use it.

---

### Task 2: Easy Automatic Code-Test Discovery

**Files:**
- Modify: `backend/src/testkit/registry.py`
- Modify: `backend/src/catalog/service.py`
- Modify: `backend/src/config.py`
- Modify: `frontend/src/pages/DocsPage.tsx`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Add recursive discovery**

In `registry.py`, add a `discover_from_path(root: Path, package_root: str = "tests.automations")` function that finds `test_*.py` and `*.py` files below `backend/tests/automations`, imports them as modules, and reuses class validation. The validation remains simple for test authors: subclass `BaseAutomationTest`, declare `metadata`, implement `execute`.

- [ ] **Step 2: Update catalog discovery**

Change `discover_tests(db, modules=None)` so `modules=None` uses recursive discovery. Keep `modules` support for compatibility only.

- [ ] **Step 3: Preserve one-file-per-test behavior**

Ensure a test class is discovered only from the module where it is defined (`obj.__module__ == module.__name__`) so shared helper subclasses imported into a file are not registered accidentally.

- [ ] **Step 4: Run discovery locally**

Run:

```bash
cd backend && AUTH_DISABLED=true python3 scripts/init_db.py
```

Expected: existing code tests are discovered without a manual module list.

- [ ] **Step 5: Update docs/TODO**

Mark auto-discovery as `[x]` after verification.

---

### Task 3: Multi-Step HTTP Execution With Captures

**Files:**
- Modify: `backend/src/testkit/context.py`
- Modify: `backend/src/testkit/result.py`
- Modify: `backend/src/testkit/adapters/http.py`
- Modify: `backend/src/execution/runner.py`
- Modify: `backend/src/execution/serializers.py`

- [ ] **Step 1: Add test-author-friendly context helpers**

Add methods to `TestContext`:

```python
def set_var(self, name: str, value: Any) -> None:
    self.variables[str(name)] = "" if value is None else str(value)


def get_var(self, name: str, default: str = "") -> str:
    return self.variables.get(name, default)
```

- [ ] **Step 2: Normalize request steps**

In `http.py`, add:

```python
def normalize_steps(config: dict[str, Any]) -> list[dict[str, Any]]:
    if isinstance(config.get("steps"), list) and config["steps"]:
        return [{**step, "id": step.get("id") or f"step-{i + 1}", "name": step.get("name") or f"Step {i + 1}"} for i, step in enumerate(config["steps"])]
    return [{"id": "request", "name": "Request", **config}]
```

Reject duplicate step ids before execution.

- [ ] **Step 3: Split single-step execution**

Refactor the existing `execute_http(config, ctx)` body into `_execute_http_step(step, ctx)` that returns a `TestResult` for one request. Keep `execute_http(config, ctx)` as the public function.

- [ ] **Step 4: Add captures**

After each successful step response, evaluate captures with supported sources `json_path`, `header`, and `body_text`; call `ctx.set_var`. A missing non-optional capture returns a failed step result with category `capture_failed`.

- [ ] **Step 5: Combine flow results**

`execute_http(config, ctx)` loops over normalized steps, stops at first non-passed result, and returns a combined `TestResult` with:

```python
response={"steps": [{"id": step_id, "name": name, "response": single.response, "captures": captured_names}]}
metrics={"elapsed_ms": total_ms, "steps_total": n, "steps_passed": passed}
```

- [ ] **Step 6: Ensure assertions identify the step**

When combining assertions, prefix messages or targets with step context so the UI can identify which step failed.

- [ ] **Step 7: Verify compatibility**

Run an existing single-request saved test through the worker. Expected: one step row persists and status behavior is unchanged.

---

### Task 4: Request-Test Backend Normalization And Seed

**Files:**
- Modify: `backend/src/catalog/service.py`
- Modify: `backend/src/catalog/serializers.py`
- Modify: `backend/src/api/request_tests.py`
- Modify: `backend/scripts/init_db.py`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Validate saved configs**

Add `normalize_request_config(config)` in `catalog/service.py` that enforces a URL/method per step, unique step ids, and valid capture names. It returns a config with `steps` for flows or the legacy shape for single requests.

- [ ] **Step 2: Use normalization on create/update/send**

Call the normalizer from `create_request_test`, `update_request_test`, and `send_request` before execution/persistence.

- [ ] **Step 3: Expose normalized steps in test detail**

`get_test_detail` should include `steps` for UI tests. Existing single-request configs expose a one-node `steps` array.

- [ ] **Step 4: Seed a multi-step httpbin test**

Add a test like:

1. `GET {{base_url}}/anything/login` with body/header assertions and capture `$.url` as `login_url`.
2. `POST {{base_url}}/anything/orders` with JSON body and assertion on `$.json.item`.
3. `GET {{base_url}}/get?from={{login_url}}` with status assertion.

- [ ] **Step 5: Update TODO**

Mark multi-step backend execution as `[~]` until UI Flow mode is complete.

---

### Task 5: Target Detail Backend And Failure Links

**Files:**
- Modify: `backend/src/catalog/service.py`
- Modify: `backend/src/reporting/service.py`
- Modify: `backend/src/api/targets.py`
- Modify: `backend/src/api/dashboards.py`
- Modify: `backend/maps/endpoint.json`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Add target detail service**

Implement `get_target_detail(db, target_id)` with target metadata, test count, run totals, pass rate, duration p50/p95, status distribution, and scheduled test count.

- [ ] **Step 2: Add target stats service**

Implement `target_stats(db, target_id, hours=168)` with trend rows, duration rows, defect distribution, recent failures, and latest per-test statuses.

- [ ] **Step 3: Add target-scoped list methods**

Expose paginated tests and runs for `target_id`; for tests, join target by `target_key` inside the same project.

- [ ] **Step 4: Add API endpoints**

Add QF endpoint map entries for:

```text
GET /api/targets/<target_id>
GET /api/targets/<target_id>/tests
GET /api/targets/<target_id>/runs
GET /api/targets/<target_id>/stats
```

- [ ] **Step 5: Add `test_definition_id` to recent failures**

Update `reporting.failures` recent rows with both `id` (run id) and `test_definition_id`.

- [ ] **Step 6: Compile backend**

Run:

```bash
cd backend && python3 -m compileall src
```

Expected: success.

---


### Task 5A: Reusable Tags And Test/Run Comments

**Files:**
- Create: `backend/src/comments/models.py`
- Create: `backend/src/comments/service.py`
- Create: `backend/src/comments/serializers.py`
- Create: `backend/src/api/comments.py`
- Create: `backend/src/api/tags.py`
- Modify: `backend/src/models_all.py`
- Modify: `backend/src/catalog/service.py`
- Modify: `backend/maps/endpoint.json`
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/api/qtp.ts`
- Create: `frontend/src/components/CommentsPanel.tsx`
- Create: `frontend/src/components/TagEditor.tsx`
- Modify: `frontend/src/pages/TestDetailPage.tsx`
- Modify: `frontend/src/pages/RunDetailPage.tsx`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Add comment model**

Create a generic `EntityComment` model with `id`, `project_id`, `entity_type`, `entity_id`, `author`, `body`, `tags`, and `created_at`. Entity type is `test` or `run`.

- [ ] **Step 2: Add comment service**

Implement `list_comments(db, entity_type, entity_id)` and `create_comment(db, entity_type, entity_id, payload, author)`. Validate non-empty body and entity type.

- [ ] **Step 3: Add reusable tag suggestions**

Implement `list_tags(db, q="")` by collecting distinct values from `TestDefinition.tags` and `EntityComment.tags`. Keep tags as user-facing strings; create-on-demand happens when a tag is saved on a test/comment.

- [ ] **Step 4: Add test tag update endpoint**

Implement `update_test_tags(db, test_id, tags)` that replaces the visible tag list after trimming duplicates. This reuses the existing `TestDefinition.tags` JSONB field.

- [ ] **Step 5: Add API routes**

Add endpoint map entries for `GET /api/tags`, `PUT /api/tests/<test_id>/tags`, `GET/POST /api/tests/<test_id>/comments`, and `GET/POST /api/runs/<run_id>/comments`.

- [ ] **Step 6: Frontend components**

Add `TagEditor` using AntD `Select mode=tags` with suggestions from `GET /api/tags`. Add `CommentsPanel` with a comment list and form; reuse it on test and run detail pages.

- [ ] **Step 7: Backend table filters**

Ensure tests can filter by `tag` and runs can search by test name/key plus filter by status, trigger, target, defect type, and failure category.

- [ ] **Step 8: TODO update**

Mark reusable tags/comments as `[~]` until both backend and frontend verification pass.

---


### Task 5B: Backend Tracing Spans

**Files:**
- Modify: `backend/src/testkit/adapters/http.py`
- Modify: `backend/src/execution/runner.py`
- Modify: `backend/src/execution/service.py`
- Modify: `backend/src/catalog/service.py`
- Modify: `backend/src/comments/service.py`

- [ ] **Step 1: Use QF tracing directly**

Import `get_tracer` from `framework.tracing` in instrumented modules. Do not add a QTP-local tracing abstraction; QF tracing.py already supplies the NoOp behavior when tracing is disabled.

- [ ] **Step 2: Add flow executor span**

Wrap multi-step HTTP execution with `with tracer.start_as_current_span("flow_executor") as span:` and set attributes for step count, final status, elapsed time, and errors.

- [ ] **Step 3: Add critical child spans**

Add spans for HTTP steps, captures, run execution, discovery, target stats, paginated run queries, comments, and tag updates.

---

### Task 6: Frontend API And React Flow Dependency

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/api/qtp.ts`
- Create: `frontend/src/components/TestFlowGraph.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Install React Flow**

Run:

```bash
cd frontend && npm install reactflow@11.11.4
```

Expected: `package.json` and `package-lock.json` include `reactflow`.

- [ ] **Step 2: Add paginated types**

Add:

```ts
export interface Page<T> { items: T[]; page: number; page_size: number; total: number; sort?: string; order?: "asc" | "desc"; }
export interface RequestStep { id: string; name: string; method: string; url: string; headers?: any[]; body?: any; assertions?: any[]; captures?: any[]; }
export interface TargetDetail { target: Target; totals: Record<string, number>; pass_rate?: number; duration_ms: { p50?: number; p95?: number; avg?: number }; status_distribution: Record<string, number>; }
```

- [ ] **Step 3: Add API helpers**

Add `testsPage`, `runsPage`, `targetsPage`, `schedulesPage`, `targetDetail`, `targetStats`, `targetTests`, and `targetRuns`. Keep `targets()` and small option helpers by calling `page_size=100` and returning `.items`.

- [ ] **Step 4: Create `TestFlowGraph`**

Use `reactflow`, `Background`, `Controls`, and `ReactFlowProvider`. Nodes should be compact and status-colored. Layout can be deterministic left-to-right without adding dagre: `position: { x: index * 230, y: 40 }`.

- [ ] **Step 5: Add CSS**

Import `reactflow/dist/style.css` in the component and add `.qtp-flow-node` styles in `index.css`.

---

### Task 7: Backend-Driven Table UI Pass

**Files:**
- Modify: `frontend/src/pages/CatalogPage.tsx`
- Modify: `frontend/src/pages/RunsPage.tsx`
- Modify: `frontend/src/pages/TargetsPage.tsx`
- Modify: `frontend/src/pages/SchedulesPage.tsx`
- Modify: `frontend/src/pages/WorkersPage.tsx` if worker endpoint receives pagination

- [ ] **Step 1: Add table state helper locally or shared**

Use React state `{ page, pageSize, q, sort, order, filters }` and serialize it into query params sent to the backend.

- [ ] **Step 2: Catalog page**

Replace local `filtered = tests.filter(...)` with backend query keys and AntD `onChange` sorting. Keep target/source/type filters but send them to `/api/tests`.

- [ ] **Step 3: Runs page**

Send status, trigger, target, search, sort, page, and page_size to `/api/runs`.

- [ ] **Step 4: Targets page**

Send search/sort/page/page_size to `/api/targets`; row click navigates to `/targets/${id}`.

- [ ] **Step 5: Schedules page**

Use paginated schedules. The test select may call `qtp.testsPage({page_size:100})` for options.

- [ ] **Step 6: TODO update**

Mark backend-driven table contract as `[~]` or `[x]` based on whether all table pages are converted.

---


### Task 8A: Sticky App Shell Sidebar

**Files:**
- Modify: `frontend/src/QtpApp.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Keep sidebar in viewport**

Set the shell so the outer layout is `height: 100vh; overflow: hidden`, the `Sider` has `height: 100vh; position: sticky; top: 0`, and `.qtp-content` is the only vertical scroller.

- [ ] **Step 2: Preserve collapsed behavior**

Verify the AntD collapsible sider still changes width and the main content remains aligned.

- [ ] **Step 3: Build check**

Run `cd frontend && npm run build`. Expected: build succeeds.

---

### Task 8: Target Detail Page

**Files:**
- Create: `frontend/src/pages/TargetDetailPage.tsx`
- Modify: `frontend/src/QtpApp.tsx`
- Modify: `frontend/src/pages/OverviewPage.tsx`
- Modify: `frontend/src/pages/TargetsPage.tsx`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Add route**

Add:

```tsx
<Route path="/targets/:id" element={<TargetDetailPage />} />
```

- [ ] **Step 2: Build target header and KPIs**

Show target key/name/base URL/health URL/environment/tags, total runs, pass rate, failed/error/timeout counts, p50/p95, tests count.

- [ ] **Step 3: Add charts**

Use ECharts for status distribution, run trend, duration trend, and defect distribution.

- [ ] **Step 4: Add target tests/runs tables**

Both tables use backend pagination/sort/filter/search. Rows navigate to `/tests/{id}` and `/runs/{id}` respectively.

- [ ] **Step 5: Link from Overview and Targets**

Overview per-target health and Targets table rows navigate to this page.

- [ ] **Step 6: TODO update**

Mark target detail API/page `[x]` after build verification.

---

### Task 9: Test Detail Flow Visualization And Overview Failure Links

**Files:**
- Modify: `frontend/src/pages/TestDetailPage.tsx`
- Modify: `frontend/src/pages/OverviewPage.tsx`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Read `runId` from query string**

Use `useSearchParams`; when present, fetch `qtp.run(runId)`.

- [ ] **Step 2: Add Flow tab**

Render `TestFlowGraph` using `t.steps` for UI tests or a Python file node for code tests. If selected run steps exist, color nodes by matching step id/name.

- [ ] **Step 3: Highlight selected run context**

Show a compact alert/card above tabs when `runId` was supplied, with status, duration, failure category, and link to full run detail.

- [ ] **Step 4: Overview recent failures clickable**

Change recent failure table `onRow` to navigate to `/tests/${test_definition_id}?runId=${id}`. If `test_definition_id` is missing, fall back to `/runs/${id}`.

- [ ] **Step 5: TODO update**

Mark React Flow and Overview failure-link tasks as `[x]` after frontend build.

---

### Task 10: Request Builder Flow Mode

**Files:**
- Modify: `frontend/src/pages/RequestBuilderPage.tsx`
- Modify: `frontend/src/api/types.ts`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Introduce local step model**

Use one state array `steps: RequestStep[]`. Single mode edits `steps[0]`; flow mode exposes all steps.

- [ ] **Step 2: Add mode segmented control**

Options: `Single Request` and `Flow`. The same send/save/update/schedule commands operate on the current config.

- [ ] **Step 3: Add step operations**

Implement add, duplicate, delete, move up/down, rename, and select active step. Use icon buttons and tooltips.

- [ ] **Step 4: Add captures editor**

Per step, allow capture rows with name, source, path/header name, optional flag.

- [ ] **Step 5: Load legacy and flow configs**

When loading saved tests, if `config.steps` exists use it; otherwise convert legacy config into one step for the editor while saving can keep single mode legacy shape or flow mode `steps` shape.

- [ ] **Step 6: Show step-by-step send results**

Render response timeline from `result.response.steps` when present; keep the current single-response viewer fallback.

- [ ] **Step 7: TODO update**

Mark Request Builder Flow mode `[x]` after build and manual send/save smoke checks.

---

### Task 11: Developer Docs And Ergonomics Pass

**Files:**
- Modify: `frontend/src/pages/DocsPage.tsx`
- Modify: `README.md` if quickstart text needs to mention auto-discovery
- Modify: `docs/TODO.md`

- [ ] **Step 1: Replace manual registration language**

Docs must say: create one Python file under `backend/tests/automations/`, subclass `BaseAutomationTest` or a helper subclass, and click Discover. No manual module registration.

- [ ] **Step 2: Add complete multi-step Python example**

Provide one copyable file that logs in, posts data, verifies via GET, and cleans up if applicable.

- [ ] **Step 3: Add complete UI flow config example**

Show `steps`, `captures`, and `{{variable}}` usage.

- [ ] **Step 4: Add target page docs**

Explain that `/targets/{id}` is where users inspect all tests/runs/statistics for an app under test.

- [ ] **Step 5: Add backend table API docs**

Document `page`, `page_size`, `q`, `sort`, `order`, and filters.

- [ ] **Step 6: TODO update**

Mark Developer Docs enrichment `[x]`.

---

### Task 11A: Horizontal Scalability Review

**Files:**
- Review backend service/API changes
- Modify docs only if a scaling caveat is found

- [ ] **Step 1: Check API state**

Confirm new API handlers do not use module-level mutable state for pagination, comments, tags, target stats, or request-builder sends.

- [ ] **Step 2: Check worker state**

Confirm multi-step captures live only in the per-run `TestContext` during execution and are persisted into the run response/metrics when needed. No worker process-global state participates in correctness.

- [ ] **Step 3: Check scheduler/queue behavior**

Confirm existing `FOR UPDATE SKIP LOCKED` queue and due-schedule patterns remain intact and are not bypassed by new execution paths.

---

### Task 12: Verification And Final TODO Sweep

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Backend compile**

Run:

```bash
cd backend && python3 -m compileall src tests
```

Expected: success.

- [ ] **Step 2: Frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: Vite production build succeeds.

- [ ] **Step 3: Docker smoke**

Run:

```bash
docker compose up -d --build
```

Expected: API, worker, scheduler, frontend, Keycloak, Postgres, and httpbin are healthy/running.

- [ ] **Step 4: API smoke checks**

Verify:

```bash
curl -s http://localhost:5100/qtp/health
curl -s http://localhost:5100/qtp/api/targets -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:5100/qtp/api/tests?page=1&page_size=5 -H "Authorization: Bearer $TOKEN"
```

Expected: health OK, paginated envelopes returned for table endpoints.

- [ ] **Step 5: UI smoke checks**

In browser verify:

- Overview recent failures click to test detail.
- Targets row opens `/targets/{id}`.
- Test detail Flow tab renders steps.
- Request Builder can send a multi-step flow and save/update it.
- Tables page, search, filter, and sort via backend query params.

- [ ] **Step 6: Final TODO sweep**

Update `docs/TODO.md` with `[x]`, `[~]`, or `[ ]` for every item in the next increment section.

- [ ] **Step 7: Commit implementation**

Commit in logical slices if possible. Final commit message should summarize implemented scope.
