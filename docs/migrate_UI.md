# QTP UI/UX Migration Plan — Toward an Enterprise-Grade Product

_Last updated: 2026-07-10._

Goal: evolve the QTP web app from a competent-but-default **Ant Design 5** dashboard
into a product that reads like **Linear, Datadog, Jira, GitLab, Sentry, or Grafana** —
calm, dense, consistent, and confidence-inspiring — without a framework rewrite.

This plan is written against the current code in `frontend/src/` and was validated by
running the app (`docker compose up`) and screenshotting every page (light + dark).
It stays on the existing stack — **React 18 + Vite + AntD 5 (`ConfigProvider` tokens) +
React Query + React Router 6 + ECharts + React Flow** — and layers a real design system
on top. No page needs to be thrown away; most of the lift is in **tokens, a handful of
shared primitives, and removing redundancy**.

## Legend
- **[P0]** foundation — do first; unblocks everything else
- **[P1]** high impact / low-to-medium effort
- **[P2]** high impact / higher effort
- **[P3]** polish & delight
- Effort: **S** ≈ ≤0.5d · **M** ≈ 1–2d · **L** ≈ 3–5d (single dev)

---

## 1. Executive summary

The app is **structurally sound** — good IA (grouped sidebar), server-driven tables,
dark mode, responsive drawer, React Query everywhere. What holds it back from feeling
"enterprise" is **polish and consistency**, not architecture. The biggest wins are
cheap:

1. **Kill the duplicated page titles.** Every page prints its title twice — once in the
   top header (from `QtpApp.tsx`) and again as a big `Typography.Title level={3}` in the
   page body. This is the single most "unfinished" tell. Replace with one **breadcrumb +
   page-header** pattern (Jira/GitLab/Linear all do this).
2. **Adopt one design-token source of truth** (light + dark) consumed by AntD, plain CSS,
   *and* ECharts. Today status green is `#52c41a` in charts but `#16a34a` in pills — the
   same concept, three different greens.
3. **Actually ship the typeface.** The CSS asks for `Inter` everywhere but the font is
   never loaded — the whole app silently renders in `system-ui`. Self-host Inter (or
   Geist/IBM Plex Sans) and the type instantly looks intentional.
4. **Densify tables and unify the status system.** Rows wrap to 3–4 lines today; enterprise
   tables are single-line, scannable, and reveal controls on hover.
5. **Refine the palette** toward a Linear/Datadog neutral-plus-indigo system, in both
   light and a true dark (not the current navy) theme.

Do §3 (tokens) + §4.1 (page header) + §5 font first — that alone changes the perceived
quality bar. Everything after is incremental.

Beyond that baseline, **§2.2–§2.6 are focused deep dives** into the five highest-friction
surfaces — the static Overview chart grid, run-detail Comments, Request Builder, the
fumadocs-based Docs page, and the hard-to-follow Audit ledger — each with code-level findings
and a concrete redesign matched to a reference app.

---

## 2. Current-state audit (what the screenshots show)

| Area | Observation | Why it reads as "not enterprise" |
|---|---|---|
| **Page headers** | Title shown in top bar *and* repeated as `<Title level={3}>` in body (e.g. "Overview" + "Operational Overview"; "Audit" + "Audit Explorer" with an *identical* subtitle). | Redundant, wastes the most valuable vertical space, and the top-bar title goes stale on detail pages (Run detail still says "Runs"). |
| **Navigation** | No breadcrumbs. Detail pages use back-buttons ("Runs", "Open scenario"). | Users lose their place; Jira/GitLab/Sentry all lead with breadcrumbs. |
| **Typography** | `Inter` requested but never loaded → system font. Page titles are heavy 24–30px; body is 14px. | Falls back to a different font than designed; titles feel oversized/blunt vs. Linear's tight 13px body + restrained headings. |
| **KPI cards (Overview)** | 10 equal-weight stat tiles, wrapping 4→4→2, no grouping or hierarchy. | Visual noise; no "what matters most" signal. Datadog groups + sizes by importance. |
| **Scenarios page** | Two giant near-empty cards ("Matching tests 79", "Current page 20"). | Very low information density; looks like placeholder scaffolding. |
| **Tables** | Rows wrap to 3–4 lines (scenario names, audit descriptions, correlation IDs). Header shows sort arrows + filter funnel + search glyph all at once. | Enterprise tables are dense, single-line, truncate-with-tooltip, and reveal affordances on hover. |
| **Status language** | Two visual systems: custom rounded **pills** (`StatusTag`/`DefectTag`) *and* AntD `Tag` (Cleanup column, assertions ✓/✗, Audit actions). | Same concept rendered two ways; inconsistent color + shape. |
| **Charts (ECharts)** | Default theme; legend circle markers; colors (`#52c41a`, `#ff4d4f`, `#faad14`) don't match the app tokens; not dark-aware (light plots, gray printer empty-state in dark). | Charts look bolted-on, not part of the product. |
| **Empty states** | Default AntD `<Empty>` illustrations (gray printer/inbox). | Generic; clashes in dark mode. |
| **Elevation** | Heavy `0 6px 20px` shadows on flat cards. | Enterprise UIs are border-first, shadow only on overlays/hover. |
| **Color** | Primary `#2563eb` is fine but the neutral ramp is ad-hoc `rgba(148,163,184,…)` mixes; dark is navy `#0b1220/#0f172a`. | Neutrals aren't a coherent ramp; navy dark feels more "admin panel" than Linear/Datadog near-black. |
| **Detail pages** | Metadata via `Descriptions`, tab strip, inline colored `<div>`s with hardcoded `#fff2f0`/`#91caff`. | Hardcoded hex bypasses theming (breaks in dark mode); no consistent "section" container. |

Strengths to **preserve**: grouped sidebar IA, sticky sidebar + mobile drawer, server-driven
filter/sort/paginate helpers (`remoteTable.tsx`), React Query polling, the Request Builder
(Postman-like) layout, the run-detail Comments component, `StatCard` structure.

### 2.1 Reference screenshots

Baseline captures of the live app (`docker compose up`, 1440×900) live in
[`docs/screenshots/`](./screenshots) and back every finding above:

| Page | Light | Dark |
|---|---|---|
| Overview | [`overview-light.png`](./screenshots/overview-light.png) | [`overview-dark.png`](./screenshots/overview-dark.png) |
| Runs | [`runs-light.png`](./screenshots/runs-light.png) | [`runs-dark.png`](./screenshots/runs-dark.png) |
| Run detail (+ comments) | [`run-detail-light.png`](./screenshots/run-detail-light.png) | — |
| Scenarios | [`scenarios-light.png`](./screenshots/scenarios-light.png) | — |
| Scenario detail (flow canvas) | [`scenario-detail-light.png`](./screenshots/scenario-detail-light.png) | — |
| Request Builder | [`request-builder-light.png`](./screenshots/request-builder-light.png) | [`request-builder-dark.png`](./screenshots/request-builder-dark.png) |
| Request Builder (response) | [`request-builder-response-light.png`](./screenshots/request-builder-response-light.png) | — |
| Schedules | [`schedules-light.png`](./screenshots/schedules-light.png) | — |
| Targets | [`targets-light.png`](./screenshots/targets-light.png) | — |
| Workers | [`workers-light.png`](./screenshots/workers-light.png) | — |
| Audit | [`audit-light.png`](./screenshots/audit-light.png) · [`audit-expanded-light.png`](./screenshots/audit-expanded-light.png) | — |
| Docs | [`docs-light.png`](./screenshots/docs-light.png) | — |
| Profile | [`profile-light.png`](./screenshots/profile-light.png) | — |

Re-capture after each phase to track the before/after (the Playwright script used is in the
session scratchpad — logs in via Keycloak `admin:admin` and shoots each route).

### 2.2 Deep dive — Overview dashboard: **static grid → composable widgets**

Today `OverviewPage.tsx` hardcodes the whole dashboard: a fixed `Row/Col` of 10
`StatCard`s, then chart cards in fixed spans (`lg={16}`/`lg={8}`) with hardcoded heights
(`style={{ height: 280 }}`) and one global time-range control. It renders fine, but it is
**not a dashboard — it's a static page**. Against Datadog/Grafana (and Sentry dashboards),
the gaps are:

- **Not composable.** Users can't reorder, resize, hide, or add widgets, or build their own
  view (per-team "flaky suites", "prod only", "last deploy"). Every enterprise observability
  tool treats the dashboard as a **drag-resize grid of widgets** with a widget library.
- **One global time range**; a widget can't pin its own window (Datadog per-widget time).
- **Raw ECharts**, default theme, mismatched greens, no per-widget empty/loading/error — the
  defect pie shows the default gray-printer illustration (see `overview-*`).
- **10 equal-weight KPIs**, no hierarchy or trend/delta (see §6.4).

**Decision (§12 #6): do Tier A now; defer Tier B.**

- **Tier A — the committed scope ([P1] S/M):** keep the fixed layout but fix hierarchy
  (§6.4), theme all charts (§6.5), wrap each in `<ChartCard>` with real
  empty/skeleton/error states, and add `tabular-nums` + deltas. This alone makes the Overview
  read like Datadog.
- **Tier B — deferred (not cancelled):** a composable **`DashboardGrid`**
  (`react-grid-layout` — drag + resize + responsive breakpoints) over a **widget registry**
  (`kpi`, `line`, `area`, `pie`, `bar`, `table`, `big-number`) with "Edit layout" / "Add
  widget" and per-user persistence (localStorage → a backend `dashboards` table; the API
  already exposes `/api/dashboards/overview` + `/failures`). Revisit when teams ask for
  ownable, per-user dashboards; it maps 1:1 to Grafana/Datadog.

### 2.3 Deep dive — Run detail **Comments**: good bones → GitHub/Linear-grade

`RunComments.tsx` is already the most refined component — timeline spine, hashed avatar
colors, relative time, tag chips, a proper composer (see `run-detail-light`). To reach
Jira/GitHub/Linear thread quality:

- **Read-only today.** No edit, delete, react, or reply/threading. The `resolved` / `triage`
  / `backend` chips in the screenshot are just freeform `Select` tags — **not a state
  model**. Promote "resolved" to a first-class **resolve/reopen** toggle on the thread.
- **Plain-text bodies.** `whiteSpace: pre-wrap` only — no **markdown**, code blocks,
  `@mentions`, or attachments. Enterprise comments render markdown + mention autocomplete
  (the app already bundles `react-syntax-highlighter` for code fences).
- **Hardcoded avatar palette** (`AVATAR_PALETTE` = 8 raw hex unrelated to tokens) — move to a
  token-derived ramp so it themes.
- **No optimistic insert** — `addComment` invalidates + refetches, so posting feels laggy;
  append optimistically with a pending state.
- **Heavy per-comment header** (full-width gray bar). Linear uses a calm inline
  `author · time` line; lighten it.
- **Not reused.** Audit already models `entity_comments` generically, but only runs have a UI
  thread. Extract a shared **`<Discussion entityType entityId>`** and drop it on
  scenarios/targets too.

Effort: the tokenize-palette + optimistic-add + lighter header slice is **[P1] S**; markdown
+ `@mentions` + edit/delete + resolve state is **[P2] M**.

### 2.4 Deep dive — Request Builder: strong, short of Postman/Insomnia polish

`RequestBuilderPage.tsx` (881 lines) is the most ambitious page — Splitter layout,
collections sidebar, single/flow modes, KV/Auth/Assertion/Capture editors, AI-generated
assertions. Concrete, code-level gaps (see `request-builder-*`):

- **Response body is a raw `<pre>` truncated at 5k** (`(r.body_text || "").slice(0, 5000)`,
  lines ~823/864): no syntax highlighting, no collapsible JSON tree, no pretty/raw toggle, no
  search, and it **silently drops** anything past 5000 chars. Meanwhile RunDetail renders
  bodies with `CodeSnippet` (react-syntax-highlighter) — so the *worse* renderer is on the
  more important page.
- **"Headers not implemented in preview"** (`<Empty>` on the Headers tab, lines ~824/865) —
  a shipped stub on Postman's single most-used response tab.
- **KV editors are fixed-width `Input`s in a `Space`** (`KVEditor`, `width: 220/380`), not a
  table: no bulk paste, no reorder, and the model's `enabled` flag has **no checkbox in the
  UI**. Postman/Insomnia use an editable grid with enable toggles + key autocomplete.
- **No environments.** `{{base_url}}` templating exists, but the only variable source is a
  Target dropdown that string-replaces `{{base_url}}`. Postman's environments/variable sets
  are missing.
- **Method colors** reuse AntD `Tag` presets (`METHOD_COLOR`: GET→`success` green) which
  **collides with the pass/fail status green** — method colors need their own non-status ramp.
- **Two flow visual languages in one app.** Flow mode is a hand-rolled `<div>` step list with
  no drag-reorder, while `ScenarioDetailPage` renders steps as a **React Flow graph**
  (`ExecutionFlow`, `scenario-detail-light`). Pick one flow metaphor.
- Header uses yet another title variant (`Typography.Title level={4}`).

**Proposal:** a shared **`<ResponseViewer>`** (syntax-highlighted body + JSON tree +
raw/pretty + copy + size badge, no silent truncation) reused by RB *and* RunDetail; **wire
the Headers tab** (data is available server-side); turn KV editors into a **`<ParamsTable>`**
with enable toggles + reorder + key suggestions; add an **Environments** panel; give methods
a dedicated color ramp; allow drag-reorder in Flow (and converge on the ExecutionFlow graph
language); add **"Copy as cURL"** + request history. The response-viewer + Headers-tab slice
is **[P1] M** and high-value; the rest **[P2]**.

### 2.5 Deep dive — Docs: **fumadocs is imported but not actually used**

`DocsPage.tsx` (1104 lines) imports only `Callout` + `Cards/Card` from `fumadocs-ui` plus
`fumadocs-ui/style.css`, yet **the entire docs experience is hand-rolled**: the content is a
giant hardcoded React/JSX tree, and the nav / TOC / hero / headings / tables are custom
`.qtp-docs-*` CSS in `index.css` with hardcoded colors (`#64748b`, `#2563eb`) that don't
theme in dark mode. We pay fumadocs' CSS weight for ~2 components while missing everything a
docs framework is *for*. Problems:

- **Content is code.** Every doc edit is a React edit + redeploy; no MDX, no non-dev
  authoring, no versioning.
- **No docs search** — fumadocs' headline feature — and only manual anchor scrolling.
- **fumadocs `style.css` fights AntD tokens** and ships unused styles; the hero (44px) and
  heading scale don't match the app type scale (§3.4).
- **Dark mode partially broken** (hardcoded light hex in hero/nav/table; see the `.qtp-docs-*`
  block in `index.css`).

**Decision (§12 #7): Option A — commit to fumadocs.** Move doc bodies to **MDX** files; use
fumadocs' layout + generated **TOC** + **search**; theme fumadocs through its CSS variables
mapped to our tokens (§3). Deletes ~1000 lines of hand-rolled `DocsPage.tsx` + most
`.qtp-docs-*` CSS, and gains search + real MDX authoring — closest to Stripe/Vercel/GitLab
docs. Also align hero/heading sizes to §3.4. Effort: **M/L**.

> Wiring note: fumadocs' content pipeline is MDX-first; in this Vite SPA, load the MDX via an
> `@mdx-js/rollup` (or `vite-plugin-mdx`) step and mount fumadocs' UI components. Budget a
> spike to confirm the Vite (non-Next.js) integration path before Phase 4.

### 2.6 Deep dive — Audit: make the ledger legible (event stream, not a spreadsheet)

`AuditTable.tsx` is the hardest page to read (see `audit-light`, `audit-expanded-light`),
and it's structural:

- **Three columns say the same thing.** `Action` (`CREATED` tag) + `Entity`
  (`entity_comments` tag + truncated UUID) + `Description` ("User (admin) created this entity
  comment.") are redundant; the human sentence in `getAuditDescription()` is the useful one
  but it's column #5 and **wraps to ~4 lines**.
- **Wrapping + truncation everywhere.** `Time` is a wide fixed column; `Correlation ID`
  ellipsizes with **no copy affordance**.
- **Two competing navigations.** Row-click → `/audit/:id` *and* a separate `View` link →
  entity. Ambiguous.
- **Expanded row is a raw JSON dump** (`JSON.stringify(old/new, null, 2)`) on a hardcoded
  `#fafafa` background (**breaks in dark mode**) — the one genuinely useful thing (what
  changed) is rendered as the least readable thing. It should be a **field-level diff**.
- **Filters hidden** in column dropdowns; the toolbar only has search + date range.
- **Actor inconsistency** (`System` vs `admin` vs `-`).

**Proposal — reframe as an event stream (Sentry/Datadog/GitLab activity):**

- **Log/timeline layout**, not a wide table: each event = `[action icon] Actor <verb>
  Entity · relative time`, i.e. the sentence you already generate, with Action/Entity demoted
  to inline chips. One legible line per event.
- **Structured diff on expand**: old→new per field, colorized add/remove, tokenized
  background; make correlation/trace IDs **copyable** and link the trace to Jaeger
  (`trace_id` already flows through runs).
- **Group by `correlation_id`** so all events from one request/run collapse together — the
  key to "what happened in this run".
- **Filter chips** (§6.2) for action / actor / entity_type / date + quick toggles
  ("only changes", "only system", "only user"); **one** navigation (entity chip → entity,
  row → detail); normalize the actor field.

Effort: **[P2] M**.

---

## 3. [P0] The design system (foundation) — Effort: **M**

Everything else depends on this. The core move: **one token module** that feeds AntD's
`ConfigProvider`, CSS custom properties, and a shared ECharts theme — so a color is
defined exactly once.

### 3.1 Token architecture

Create `frontend/src/theme/tokens.ts` (single source of truth) and
`frontend/src/theme/antdTheme.ts` (maps tokens → AntD). Emit the same values as CSS
variables on `:root` / `:root[data-theme="dark"]` (replaces the ad-hoc block at the top of
`index.css`) and export an `echartsTheme(mode)` (see §6.5).

```
tokens.ts ─┬─→ antdTheme.ts        → <ConfigProvider theme={…}>
           ├─→ cssVars(mode)       → injected <style> / index.css :root
           └─→ echartsTheme(mode)  → <ReactECharts theme={…}>
```

### 3.2 Recommended palette

Recommendation: **neutral-plus-indigo**, leaning Linear/Datadog. Indigo is more distinctive
than the current pure blue while staying enterprise-sober. (Conservative fallback: keep
`#2563eb` blue — swap only the `brand.*` row and everything else holds.)

**Brand / primary (indigo)**

| Token | Light | Dark | Use |
|---|---|---|---|
| `brand.solid` | `#4f46e5` | `#6366f1` | primary buttons, active nav, links, focus ring |
| `brand.hover` | `#4338ca` | `#7c7cf0` | hover/pressed |
| `brand.tint` | `#eef2ff` | `rgba(99,102,241,.16)` | selected rows, subtle fills |
| `brand.border` | `#c7cbf5` | `rgba(99,102,241,.38)` | focused input border |

**Neutral ramp — light** (calm, slightly cool):

| Token | Value | Use |
|---|---|---|
| `bg.app` | `#f7f8fa` | page canvas |
| `bg.surface` | `#ffffff` | cards, header, sider content |
| `bg.subtle` | `#f2f4f7` | table header, hover, nested panels |
| `border.subtle` | `#e7e9ee` | hairlines, card borders |
| `border.strong` | `#d5d9e0` | inputs, dividers under load |
| `text.primary` | `#191b21` | headings, values |
| `text.secondary` | `#5a6472` | labels, secondary |
| `text.tertiary` | `#8b93a1` | hints, disabled, placeholders |

**Neutral ramp — dark** (true neutral near-black, *replaces* navy):

| Token | Value | Use |
|---|---|---|
| `bg.app` | `#0b0c0e` | page canvas |
| `bg.surface` | `#151619` | cards, header |
| `bg.subtle` | `#1c1e22` | table header, hover, nested |
| `border.subtle` | `#26292e` | hairlines |
| `border.strong` | `#34383f` | inputs, dividers |
| `text.primary` | `#e7e9ec` | headings, values |
| `text.secondary` | `#9aa1ab` | labels |
| `text.tertiary` | `#6b7280` | hints |

> Sidebar: keep it a touch darker than the canvas for depth. Light: `#12141a` (near-black,
> not the current `#0f172a` navy — reads more premium). Dark: `#0e0f12`.
> _Alternative:_ if you prefer to keep the current navy dark theme, swap the dark `bg.*`
> column for `#0b1220 / #0f172a / #1e293b` — the rest of the system is unaffected.

### 3.3 Unified status tokens

One definition per status, with `solid` (dot/chart/icon), `fg` (text on tint), `bg` (tint).
Used by **both** the status badge component (§6.3) and the chart theme (§6.5) — this is what
kills the `#52c41a` vs `#16a34a` split.

| Status | solid (light / dark) | Semantics |
|---|---|---|
| `pass` / passed | `#16a34a` / `#3fb950` | success |
| `fail` / failed | `#e5484d` / `#f76c6c` | assertion failure |
| `error` | `#ea580c` / `#fb8c3d` | execution error |
| `timeout` / warning | `#d97706` / `#f0a92c` | amber |
| `running` / info | `= brand.solid` | live |
| `queued` | `#0891b2` / `#2bb8cf` | cyan |
| `canceled`/`skipped`/neutral | `#64748b` / `#8b93a1` | slate |

Defect-type colors reuse the same set (`product_bug`→fail, `automation_bug`→timeout,
`system_issue`→violet `#9333ea/#a855f7`, `to_investigate`→brand, `no_defect`→pass).

### 3.4 Scale primitives

- **Spacing** (4px grid): `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40`. Standardize page padding at
  `24` (desktop) / `16` (tablet) / `12` (phone) — already close; formalize as tokens.
- **Radius**: `sm 6 · md 8 · lg 10` (tighten from current 8/12; cards `10`, controls `8`,
  inputs `8`, badges `6`). Fully-round only for avatars and live dots.
- **Typography** (denser, Linear-like): base **13px**, line-height 1.5.
  - Page title `18/600`, section `14/600`, body `13/400`, label `12/500`,
    micro-label `11/600` uppercase `+0.06em` (the sidebar group style — reuse it),
    mono `12.5` (`ui-monospace, "JetBrains Mono", SFMono-Regular`).
  - Retire `Typography.Title level={3}` (24–30px) as a page title.
- **Elevation** (border-first): `shadow.none` for resting cards (rely on `border.subtle`);
  `shadow.sm 0 1px 2px rgba(16,24,40,.06)` for raised; `shadow.overlay 0 8px 24px
  rgba(16,24,40,.12)` for popovers/menus/modals/drawers only. Cut the resting `0 6px 20px`.
- **Motion**: `120ms ease` (hover/color), `180ms ease` (position/expand). Respect
  `prefers-reduced-motion`.
- **Focus**: a visible `2px` `brand.solid` ring (`box-shadow: 0 0 0 3px brand.tint`) on all
  interactive elements — today keyboard focus is nearly invisible.

### 3.5 AntD `ConfigProvider` — before → after

Replace the inline `appTheme` in `QtpApp.tsx` with `buildAntdTheme(mode)` from
`theme/antdTheme.ts`. The shape stays the same; values come from tokens:

```ts
// theme/antdTheme.ts  (illustrative — reads from tokens.ts)
export const buildAntdTheme = (mode: Mode) => {
  const t = tokens[mode];
  return {
    algorithm: mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: t.brand.solid,      // #4f46e5
      colorInfo:    t.brand.solid,
      colorSuccess: t.status.pass.solid,
      colorError:   t.status.fail.solid,
      colorWarning: t.status.timeout.solid,
      colorBgLayout: t.bg.app,
      colorBgContainer: t.bg.surface,
      colorBorderSecondary: t.border.subtle,
      colorText: t.text.primary,
      colorTextSecondary: t.text.secondary,
      borderRadius: 8, borderRadiusLG: 10, borderRadiusSM: 6,
      fontFamily: "'Inter var', Inter, system-ui, sans-serif",
      fontSize: 13, controlHeight: 34, wireframe: false,
      boxShadowSecondary: t.shadow.sm,  // NOT 0 6px 20px
    },
    components: {
      Table:  { headerBg: t.bg.subtle, headerColor: t.text.secondary,
                cellPaddingBlock: 8, rowHoverBg: t.brand.tint, borderColor: t.border.subtle,
                headerSplitColor: "transparent" },
      Card:   { borderRadiusLG: 10, paddingLG: 16 },
      Menu:   { /* keep current dark-item tuning, source colors from tokens */ },
      Button: { fontWeight: 500, primaryShadow: "none", defaultShadow: "none" },
      Segmented: { trackBg: t.bg.subtle },
      Tabs:   { horizontalItemGutter: 20 },
    },
  };
};
```

Key deltas from today: base font **14→13**, control height **36→34**, resting shadow
**heavy→`sm`**, table cell padding **12→8** (denser), all colors from one ramp.

---

## 4. [P1] App shell & navigation — Effort: **M**

### 4.1 One page-header pattern (kills the duplicate titles)

Introduce `components/PageHeader.tsx`:

```
┌───────────────────────────────────────────────────────────────┐
│ Runs / Faker · realistic person names            [⟳][Re-run ▸] │   ← breadcrumb + actions
│ Execution history across every scenario                        │   ← optional subtitle (1×)
└───────────────────────────────────────────────────────────────┘
```

- Left: **breadcrumb** (`Home › Section › Entity`) using React Router, driven by a small
  route→label map (extend the existing `PAGE_META`). The breadcrumb replaces the stale
  top-bar title *and* the in-body `Title level={3}`.
- Right: a **slot for page actions** (the buttons that today float above each table —
  "New schedule", "Delete All Runs", "Discover code scenarios", live toggle).
- The top app-bar (`.qtp-header`) keeps only: mobile nav toggle, breadcrumb (or global
  search trigger), theme toggle, user menu. Remove its per-page title/subtitle block.

Apply on every page: delete each `<Typography.Title level={3}>…</Typography.Title>` +
its sibling secondary text and replace with `<PageHeader breadcrumb={…} title actions />`.
This single change removes the most conspicuous "unfinished" signal and reclaims ~64px of
vertical space per page.

### 4.2 Sidebar refinements

- Keep the grouped IA and the active accent bar. Reduce logo weight; source colors from
  tokens; use the near-black sidebar bg (§3.2).
- Collapse should show **icon-only with tooltips** (already partly there) and remember state.
- Add a **subtle top border under the sider header** and align the 64px header height with
  the app bar so the two rails line up pixel-for-pixel (currently both 64 — keep, just
  verify after padding changes).

### 4.3 [P2] Command palette (⌘K) — Effort: **M**

The strongest "this is a serious product" signal (Linear, Sentry, GitLab, Datadog all have
it). Add `components/CommandPalette.tsx` built on **`cmdk`** (§12 #5 — its fuzzy matching +
keyboard model beat a hand-rolled AntD modal; skin it with our tokens): navigate to any page,
jump to a run/scenario/target by name (reuse existing search endpoints), toggle theme,
trigger "New schedule / New request". Bind `⌘K` / `Ctrl-K` globally. Ship a v1 that only does
**navigation + theme**; wire entity search next.

### 4.4 [P3] Global keyboard shortcuts

`g o` overview · `g r` runs · `g s` scenarios · `/` focus table search · `?` shortcut
cheatsheet · `t` toggle theme. A tiny key-sequence hook; documented in the `?` overlay.

---

## 5. [P0] Ship the typeface — Effort: **S**

The CSS references `Inter` but nothing loads it. Fix so the design renders as intended:

1. `npm i @fontsource/inter` (self-hosted; no external CDN, works offline / behind
   Keycloak) and `import "@fontsource-variable/inter";` in `main.tsx`, **or** self-host two
   `woff2` weights (400/500/600) via `@font-face` in `index.css`.
2. Add a mono face for code/IDs (`@fontsource/jetbrains-mono` or IBM Plex Mono) — the
   Request Builder, `CodeSnippet`, correlation IDs, and trace IDs all use mono.
3. Set `font-feature-settings: "cv05","ss01"` (optional) for Inter's more geometric letters,
   and `font-variant-numeric: tabular-nums` on all metrics/tables/timestamps so numbers
   don't jitter while polling (Datadog/Grafana do this).

Result: instant, zero-layout-risk uplift in perceived quality.

---

## 6. [P1] Data-display primitives — Effort: **L** (spread across pages)

These are the reusable components that make every page consistent.

### 6.1 `<DataTable>` wrapper (dense, enterprise tables)

Wrap AntD `Table` once with the house defaults, so every list page stops re-specifying them:

- `size="middle"` with `cellPaddingBlock: 8`; **single-line rows** with
  `ellipsis: { showTitle: true }` on text columns (kills the 3–4-line wrapping) — the
  full value shows on hover/expand.
- **Sticky header**; zebra-off, hairline row dividers; hover row uses `brand.tint`.
- **Column controls on hover**: the sort/filter/search glyphs currently show at full
  opacity always — dim to ~40% and lift to 100% on header hover (Linear/Datadog pattern).
- **Row hover reveals actions**: the `⋯` menu (Runs page) should appear on row hover, not
  sit permanently in a column.
- A **toolbar slot** above the table for a single primary search + active filter chips
  (see §6.2). Keeps the server-driven `remoteTable.tsx` helpers unchanged.
- **Density toggle** (comfortable/compact) persisted to `localStorage`, like Jira/Linear.
- **Skeleton rows** on first load instead of a centered spinner (perceived speed).

### 6.2 Filter chips + unified search

Today filters hide inside column-header dropdowns (discoverable only by clicking a funnel).
Add a **filter bar**: one search input + removable **chips** showing active filters
(`status: failed ✕`, `target: qtp_self ✕`) with a "Clear all". This is the Sentry/Datadog
pattern and makes state legible. Chips read/write the same `QueryParams` the columns use, so
no backend change.

### 6.3 `<StatusBadge>` — one status language

Replace both `StatusTag`/`DefectTag` (pills) **and** the ad-hoc AntD `Tag` usages (Cleanup,
assertions ✓/✗, Audit actions) with a single `StatusBadge` reading §3.3 tokens:

- Shape: subtly-rounded rect (radius 6) with a **leading 6px dot** — GitHub/Linear style
  (reads more "enterprise" than fully-round pills; keep the pulse animation for live states).
- Variants: `solid` dot + tinted bg + colored text; optional `plain` (text-only) for dense
  tables. Sizes `sm`/`md`.
- Assertions ✓/✗ → `StatusBadge` pass/fail (not raw green/red AntD tags).
- Deprecate `components/tags.tsx`'s bespoke `Pill` once callers migrate (keep the
  `formatDurationMs`/`formatLocalTime` helpers — they're good).

### 6.4 `<MetricTile>` + Overview hierarchy

Refine `StatCard` → `MetricTile` and **impose hierarchy** on the Overview:

- **Primary strip (3–4 tiles):** Pass rate, Total runs, Running, Queue backlog — larger,
  with a **sparkline** of the selected window (ECharts mini line, no axes) under the value.
  This is the Datadog "big number + trend" pattern.
- **Secondary strip:** Failed, Errors, Cleanup fails, Active workers, p50, p95 — smaller,
  single-line, no icon chip.
- Add **delta vs. previous window** (`▲ 4%` / `▼ 2%`) with semantic color — the metric
  that most communicates "operational tool".
- `tabular-nums`; keep click-through deep links (already good).

### 6.5 `chartTheme.ts` — themed, consistent ECharts

Register one ECharts theme built from tokens (§3.3) so charts belong to the product:

- Series colors = status tokens (pass/fail/error/timeout/running) — same greens/reds as
  badges. **No more `#52c41a` vs `#16a34a`.**
- Dark-aware: `bg.surface` plot, `border.subtle` gridlines, `text.tertiary` axis labels,
  overlay-styled tooltips.
- Legend: small square markers, `text.secondary`, top-right; hide when a card title already
  names the series.
- Line charts: `smooth: 0.2`, thin 1.5px strokes, soft area gradient (12%→0), `showSymbol:
  false`. Bars: rounded top `[3,3,0,0]`, slim category gap.
- Provide `<ChartCard>` that wraps title + `ReactECharts` + a real empty/skeleton state.

### 6.6 `<EmptyState>` — replace default illustrations

Small component: a lightweight line icon (from `@ant-design/icons`, tinted `text.tertiary`)
+ title + one-line hint + optional primary action. Replace every default `<Empty>` (gray
printer/inbox) — "No failures 🎉", "No schedules yet — Create your first", "No saved
requests". Themed for dark. Kills the biggest dark-mode eyesore.

### 6.7 `<Section>` + detail-page layout

A titled container (`bg.surface`, `border.subtle`, `radius.lg`, optional header actions)
replacing loose `Card`/`Descriptions`/hardcoded-hex `<div>`s on detail pages:

- Metadata → a **key/value grid** styled from tokens (not raw `Descriptions`), `tabular-nums`.
- The Run-detail AI-analysis / cleanup / trace boxes currently hardcode `#fff2f0`,
  `#91caff`, `#e6f4ff` → **break in dark mode**. Re-skin as token-driven callouts
  (`<Callout tone="danger|info|success">`).
- Keep the tab strip; make it sticky under the page header on long run pages.

---

## 7. [P2] Page-by-page changes

Assumes §3–§6 primitives exist. Each page mostly *deletes* bespoke markup in favor of
primitives.

**Overview** (`OverviewPage.tsx`) — see deep dive §2.2 (Tier A per §12 #6)
- Remove in-body "Operational Overview" title (→ PageHeader). Keep the time-range segmented.
- MetricTile hierarchy (§6.4); themed charts (§6.5); `<ChartCard>` empty states; move
  "Recent failures" up. (Composable `DashboardGrid` deferred.)

**Runs** (`RunsPage.tsx`)
- PageHeader with actions (Delete all / Re-run queued / Re-run failed / Live). Convert the
  6-link inline overview strip into small MetricTiles or a filter-chip row.
- `<DataTable>`: single-line rows, hover-reveal `⋯`, `StatusBadge` for Status **and**
  Cleanup (drop the second green tag), filter chips (§6.2).

**Scenarios** (`CatalogPage.tsx`)
- **Delete the two giant "Matching tests / Current page" cards** — surface those counts as
  a subtle line in the PageHeader/table toolbar instead.
- `<DataTable>`; differentiate Type/Source/App with distinct token tints (not 3 identical
  blues); `faker.company_job` keys → single-line mono with ellipsis.

**Run detail** (`RunDetailPage.tsx`) — comments deep dive §2.3
- Breadcrumb `Runs › <name>` + status badge in PageHeader; actions (Cancel/Re-run/Open
  scenario) in the header slot.
- Metadata → `<Section>` key/value grid; callouts token-driven (§6.7); sticky tab strip.
- Comments → shared `<Discussion>` (markdown, `@mentions`, edit/delete, resolve, optimistic).

**Scenario detail** (`ScenarioDetailPage.tsx`)
- The `ExecutionFlow` React-Flow canvas hardcodes node colors (`#f6ffed`/`#fff2f0`/…) and a
  light `#fafafa` canvas → **breaks in dark mode**. Token-ize node/edge/background colors and
  make the canvas theme-aware; use `StatusBadge` colors for node status.

**Schedules / Targets / Workers / Profile**
- PageHeader everywhere; `<DataTable>` for Schedules; `<EmptyState>` for empty Schedules.
- Workers cards → `<Section>`/card primitive; heartbeat as a `StatusBadge`; capability chips
  tinted by token.

**Audit** (`AuditExplorerPage.tsx` + `AuditTable.tsx`) — deep dive §2.6
- Reframe as an **event stream**: log/timeline rows, structured diff on expand (drop the raw
  JSON + `#fafafa` bg), correlation grouping, filter chips, one navigation, copyable IDs.

**Request Builder** (`RequestBuilderPage.tsx`) — deep dive §2.4
- Shared `<ResponseViewer>` (highlighted body + JSON tree + raw/pretty + copy, no 5k
  truncation); **implement the Headers tab**; KV → `<ParamsTable>` with enable toggles;
  method colors on their own ramp; Environments panel; drag-reorder Flow; "Copy as cURL".

**Docs** (`DocsPage.tsx`) — deep dive §2.5 (Option A per §12 #7)
- Adopt fumadocs: content → MDX, enable search + generated TOC, theme fumadocs via its CSS
  vars mapped to our tokens; retire most of the hand-rolled `.qtp-docs-*` CSS; align
  hero/heading sizes to §3.4.

---

## 8. [P3] Delight, accessibility & QA

- **Toasts**: standardize on AntD `App.useApp().message`/`notification` with consistent
  tone + icon; success auto-dismiss, errors sticky with detail.
- **Loading**: skeletons for tables/cards/detail (not full-page spinners).
- **A11y**: visible focus rings (§3.4), `aria-label`s on icon-only buttons, `aria-live` for
  live-updating run status, verify contrast (esp. `text.tertiary` on tint) meets WCAG AA.
- **Reduced motion**: gate the live-dot pulse + hover lifts behind `prefers-reduced-motion`.
- **Tabular numerics** across all metrics/tables/timestamps (§5).
- **Empty/error/loading** state for every async surface (React Query `isError` today mostly
  renders nothing).

---

## 9. Phased rollout

| Phase | Scope | Deliverable | Risk |
|---|---|---|---|
| **0. Foundation** [P0] | §3 tokens + §3.5 AntD theme + §5 fonts | `theme/tokens.ts`, `antdTheme.ts`, Inter/mono loaded, CSS vars unified | Low — visual-only, no logic |
| **1. Shell** [P1] | §4.1 PageHeader + breadcrumbs, remove duplicate titles; §4.2 sidebar | One header pattern across all pages | Low |
| **2. Primitives** [P1] | §6.3 StatusBadge, §6.5 chartTheme, §6.6 EmptyState, §6.1 DataTable | Shared components; migrate Runs + Overview first | Med — touches every table |
| **3. Pages** [P2] | §7 page-by-page; §6.2 filter chips; §6.4 metric hierarchy; §6.7 detail | All pages on primitives | Med |
| **4. High-friction surfaces** [P2] | §2.3 `<Discussion>` · §2.4 `<ResponseViewer>` + Headers tab · §2.5 docs → fumadocs/MDX · §2.6 audit event-stream | The flagged surfaces reworked (Overview is Tier A, folded into Phase 3) | Med — feature-level, isolate each |
| **5. Power & polish** [P2/P3] | §4.3 ⌘K, §4.4 shortcuts, §8 a11y/skeletons/toasts | Command palette, keyboard, QA pass | Low-Med |

Sequencing rule: **land Phase 0 + the "remove duplicate titles" slice of Phase 1 first** —
smallest diff, largest perceived jump. Then migrate one representative page end-to-end
(Runs) as the reference implementation before rolling the pattern out. Phase 4 items are
independent features — each can be picked up on its own once the primitives (Phase 2) exist;
the cheap slices called out per deep dive (§2.3/§2.4 "[P1]") can ride along in Phase 3.

---

## 10. File-level change map

**New**
- `frontend/src/theme/tokens.ts` · `antdTheme.ts` · `cssVars.ts` · `chartTheme.ts`
- `frontend/src/components/PageHeader.tsx` · `DataTable.tsx` · `StatusBadge.tsx` ·
  `MetricTile.tsx` · `EmptyState.tsx` · `Section.tsx` · `Callout.tsx` · `ChartCard.tsx` ·
  `CommandPalette.tsx` (on `cmdk`, §12 #5) · `FilterBar.tsx`
- Deep-dive features: `Discussion.tsx` (generalizes `RunComments`, §2.3) ·
  `ResponseViewer.tsx` + `ParamsTable.tsx` (§2.4) · `ValueDiff.tsx` (audit structured diff,
  §2.6) · `docs/*.mdx` content + fumadocs layout wiring (§2.5)
- `frontend/src/hooks/useHotkeys.ts` · `useDensity.ts`
- Deferred (Tier B dashboard, §12 #6): `DashboardGrid.tsx`, `widgets/`, `useDashboardLayout.ts`

**Modified**
- `QtpApp.tsx` — theme from `antdTheme`, header trimmed, breadcrumb map, ⌘K mount
- `index.css` — CSS vars from tokens, font-face, focus rings, drop heavy shadows, tokenize
  the `.qtp-docs-*` block
- `main.tsx` — font imports
- `components/StatCard.tsx` → `MetricTile` · `tags.tsx` → `StatusBadge` (keep formatters)
- `components/ExecutionFlow.tsx` — tokenize node/edge/canvas colors (dark-mode fix, §7)
- `components/AuditTable.tsx` — event-stream layout + `ValueDiff` (§2.6)
- `components/RunComments.tsx` → `Discussion` (markdown/mentions/resolve/optimistic, §2.3)
- `pages/RequestBuilderPage.tsx` — `ResponseViewer` + Headers tab + `ParamsTable` (§2.4)
- `pages/DocsPage.tsx` — fumadocs A/B decision + tokenized styles (§2.5)
- Every other `pages/*.tsx` — swap in `PageHeader` (delete in-body `Title level={3}`),
  `DataTable`, `StatusBadge`, `EmptyState`; token-ize hardcoded hex (177 raw hex occurrences
  in `pages/` + `components/` today → target 0)

**New dependencies** (per §12): `@fontsource-variable/inter` + `@fontsource/jetbrains-mono`
(#4) · `cmdk` (#5) · `@mdx-js/rollup` or `vite-plugin-mdx` for fumadocs MDX (#7). All
self-hosted/offline-friendly — no external CDN or runtime calls (Keycloak-friendly). Deferred:
`react-grid-layout` (#6, only if Tier B is revived).

**Unchanged** (deliberately): `api/*`, `remoteTable.tsx` logic, React Query wiring, routing,
Keycloak — this is a presentation-layer migration.

---

## 11. Success criteria

- [ ] No page renders its title twice; every page leads with a breadcrumb + single header.
- [ ] Every color, radius, shadow, and status hue resolves from `tokens.ts` — zero
      hardcoded hex in `pages/*` (grep-clean).
- [ ] Charts, badges, and pills share one status palette (one green, one red, …).
- [ ] Inter (or chosen face) + a mono face are actually loaded and applied.
- [ ] Tables are single-line by default with hover-revealed controls and a density toggle.
- [ ] Dark mode has no light-plot charts, no default AntD empty illustrations, no
      hardcoded light callout boxes, and the `ExecutionFlow` canvas + audit expand are themed.
- [ ] Keyboard: ⌘K palette + visible focus rings on every interactive element.
- [ ] Overview charts belong to the product (themed, Tier A); "Recent failures" surfaced.
- [ ] Docs run on fumadocs (MDX + working search), themed light/dark; `.qtp-docs-*` retired.
- [ ] Request Builder response is highlighted (not raw `<pre>`), Headers tab works, no silent
      5k truncation.
- [ ] Audit reads as a legible event stream with a field-level diff (not raw JSON).
- [ ] Lighthouse a11y ≥ 95; AntD bundle unchanged (no framework swap).

---

## 12. Decisions (resolved — 2026-07-10)

All locked; the plan above reflects them.

| # | Decision | Chosen | Consequence |
|---|---|---|---|
| 1 | Accent | **Indigo `#4f46e5`** | `brand.*` in `tokens.ts`; logo gradient, active nav, links, focus ring |
| 2 | Dark theme | **Neutral near-black** (`bg.app #0b0c0e`) | replaces the navy family; sidebar `#0e0f12` |
| 3 | Status shape | **Rounded-rect badge + leading dot** (radius 6) | `<StatusBadge>` (§6.3) supersedes the round pills |
| 4 | Typeface | **Inter** (+ JetBrains Mono for code/IDs) | self-hosted via `@fontsource`, §5 |
| 5 | Command palette | **Add `cmdk`** (~4kb) | `CommandPalette.tsx` built on `cmdk`, not a hand-rolled modal |
| 6 | Dashboard | **Themed static charts (Tier A)** | do §6.4 hierarchy + §6.5 chart theme + `<ChartCard>` states; **no** `DashboardGrid` for now |
| 7 | Docs | **Option A — adopt fumadocs** | doc bodies → MDX, fumadocs layout + TOC + search, themed via its CSS vars |

Notes:
- **#6** scopes the Overview to Tier A only. The composable `DashboardGrid` (Tier B,
  `react-grid-layout`) is **deferred, not cancelled** — revisit once teams ask for per-user
  dashboards. `DashboardGrid.tsx`, `widgets/`, and `useDashboardLayout.ts` drop out of the
  active file map, and Phase 4's dashboard line is removed.
- **#7** commits Docs to fumadocs: migrate content to MDX, enable search, and map fumadocs
  CSS variables to our tokens (§3) so light/dark stay consistent — this deletes most of the
  hand-rolled `DocsPage.tsx` + `.qtp-docs-*` CSS.
- **#1–#5** are baked into `tokens.ts` / §5 / §6.3 / §4.3; #1–#4 flip via a single token row
  if ever revisited.
