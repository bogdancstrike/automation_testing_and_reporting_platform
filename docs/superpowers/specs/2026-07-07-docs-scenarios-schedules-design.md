# Developer Docs, Scenarios Routing, Tables, Schedules, And Worker Design

## Goal

Improve QTP for developers who author and run scenarios: make `/docs` a comprehensive Fumadocs-style developer guide, rename the frontend test catalog route to `/scenarios`, move overview to `/overview`, make list tables use backend-driven table-header search/filter/sort, support schedules that run multiple scenarios, add run-detail navigation back to the scenario, add browser/CLI/Python scenario coverage, and update the worker image for Playwright and Selenium workloads.

## Developer Documentation

The `/docs` page will be reorganized as a developer documentation experience inspired by `fumadocs.dev/docs`: left navigation, readable article content, sticky right-side table of contents, callouts, cards, code examples, and well-scoped sections. The content will target developers who use QTP, not platform administrators. It will explain QTP's purpose, scenario authoring, targets, assertions, captures, scheduling, execution, CI integration, scenario types, adapters, and troubleshooting.

Fumadocs packages will be evaluated in the existing Vite/React Router SPA. If the official layout package fits without destabilizing the current shell, it will be used directly. If it requires a full React Router framework/Tailwind conversion that is too invasive for this app, the local route will implement the Fumadocs-style UX while keeping the app stable and documented.

## Routing

Frontend `/tests` becomes `/scenarios`; `/tests` and `/tests/:id` will redirect to `/scenarios` and `/scenarios/:id` for backward compatibility. The navigation label becomes `Scenarios`. The backend API remains `/api/tests` because that is the existing API contract.

The overview route moves from `/` to `/overview`; `/` redirects to `/overview`.

Run detail gets an `Open scenario` shortcut linking to `/scenarios/{run.scenario_id}`.

## Remote Table Pattern

List screens will use Ant Design table header controls rather than separate filter forms. A reusable helper will translate Ant Design sorter/filter/search UI state into backend query parameters. The first targets are Scenarios, Runs, Schedules, Targets, and the overview drill-down tables. Backend support will be added where a visible column does not yet have a parameter or sort key.

## Multi-Scenario Schedules

Schedules will support one or more test definitions. A normalized association table will connect schedules to tests while retaining compatibility with the existing single `scenario_id` column during migration. Create/update APIs will accept `scenario_ids`, and serializers will return `tests` plus summary fields. The scheduler will enqueue one run per associated scenario when the schedule is due. Schedule detail will show all scheduled scenarios and recent runs.

## Scenario Types And Worker Image

Add qtp_self scenarios for `CliTest`, `PythonTest`, `PlaywrightTest`, and `SeleniumTest`, ten of each. Update the shared backend/worker Docker image so worker containers include Playwright, Chromium dependencies, Selenium, and browser-driver support. Worker capabilities will include `http,python,cli,playwright,selenium` in Docker Compose.

## Verification

Run frontend build, Python compile/discovery checks, and any available tests. Commit and push at stable checkpoints.
