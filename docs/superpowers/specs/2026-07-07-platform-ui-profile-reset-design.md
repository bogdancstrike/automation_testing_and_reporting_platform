# Platform UI, Profile, Reset Stats Design

## Goal

Improve the Quality Testing Platform frontend structure and visual quality, add platform-wide dark mode, add a user profile page, support soft reset of target execution statistics, expose test discovery time in the catalog, and expand bundled automation scenarios.

## App Shell And Visual Direction

The shell will keep Ant Design as the component foundation and make the application feel more like an operations platform. The sidebar will be grouped by workflow:

- Monitor: Overview, Runs, Schedules
- Test Design: Test Catalog, Request Builder
- Assets: Targets, Workers
- Knowledge: Developer Docs

The header will contain a dark mode icon button and the user menu. The user menu will link to the profile page and keep logout. The UI will use theme-aware CSS classes and Ant Design `ConfigProvider` algorithms so all existing pages inherit a consistent light/dark palette.

## Profile Page

The profile page will live at `/profile`. It will show identity data from `/api/me`, role tags, admin state, and recent executions. Recent executions will come from the existing runs listing API with a small page size. Because run rows do not currently store the triggering user, the first version will present recent platform executions visible to the user, with API types left extensible for actor-owned runs when persisted actor fields are added.

## Target Stats Reset

The target detail page will get a danger-zone action named `Reset stats`. The action will use a double confirmation: a first confirmation modal, then a second explicit confirmation modal before calling the API.

The backend will not hard-delete runs. It will add soft reset metadata to `test_runs`:

- `stats_reset_at`
- `stats_reset_by`
- `stats_reset_reason`

Resetting a target marks all runs for that target with reset metadata and removes queued work for those runs from the active queue. User-facing run lists, run details, target detail stats, target stats, dashboard aggregates, and failure dashboards will exclude reset runs by default.

## Test Catalog Added At

The API already serializes `created_at` for tests. The frontend type will expose it and the Test Catalog table will add an `Added at` column sorted by `created_at`.

## Automation Scenarios

Add at least 30 qtp_self scenarios and 20 httpbin scenarios under `backend/scenarios/automation`. The set will include simple single-step coverage and multi-step flows where later steps depend on data captured by earlier steps.

## Verification

Run frontend type/build verification with `npm run build` from `frontend`. Run backend tests with `pytest` where the local environment supports the required services. Run scenario discovery through the existing catalog discovery path when possible.
