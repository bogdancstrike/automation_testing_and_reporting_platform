import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import {
  AimOutlined, AuditOutlined, BookOutlined, ClockCircleOutlined, ClusterOutlined,
  DashboardOutlined, ExperimentOutlined, FileTextOutlined, LogoutOutlined,
  MoonOutlined, PlayCircleOutlined, SendOutlined, SunOutlined, UserOutlined,
} from "@ant-design/icons";

import { keycloak } from "../keycloak";
import { qtp } from "../api/qtp";
import { StatusTag } from "./tags";
import { sections as DOC_SECTIONS } from "../pages/DocsPage";
import type { Mode } from "../theme/tokens";

// Open the palette from anywhere (e.g. the header search button) without
// threading callbacks: dispatch this event and the mounted palette reacts.
export const OPEN_COMMAND_PALETTE_EVENT = "qtp:open-command-palette";
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
}

export const isMacPlatform =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

interface StaticCommand {
  label: string;
  keywords: string;
  icon: React.ReactNode;
}

// Every navigable page in the shell. Keywords broaden what the fuzzy search hits.
const PAGES: (StaticCommand & { to: string })[] = [
  { to: "/overview", label: "Overview", icon: <DashboardOutlined />, keywords: "dashboard home metrics operational" },
  { to: "/runs", label: "Runs", icon: <PlayCircleOutlined />, keywords: "executions history results" },
  { to: "/schedules", label: "Schedules", icon: <ClockCircleOutlined />, keywords: "cron cadence triggers recurring" },
  { to: "/scenarios", label: "Scenarios", icon: <ExperimentOutlined />, keywords: "tests catalog definitions" },
  { to: "/request-builder", label: "Request Builder", icon: <SendOutlined />, keywords: "http postman no-code builder" },
  { to: "/targets", label: "Targets", icon: <AimOutlined />, keywords: "apps environments systems under test" },
  { to: "/workers", label: "Workers", icon: <ClusterOutlined />, keywords: "fleet capabilities executors health" },
  { to: "/docs", label: "Developer Docs", icon: <BookOutlined />, keywords: "documentation guide help reference" },
  { to: "/audit", label: "Audit", icon: <AuditOutlined />, keywords: "events ledger log who did what" },
  { to: "/profile", label: "Profile", icon: <UserOutlined />, keywords: "account me user settings" },
];

// Split `q` into terms; an item matches when its haystack contains all of them.
function matches(haystack: string, q: string): boolean {
  if (!q) return true;
  const hay = haystack.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((term) => hay.includes(term));
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  setMode: (mode: Mode) => void;
}

/**
 * Ctrl/⌘K command palette: jump to any page, run a quick action, or search
 * live scenarios, runs, and documentation. Built on `cmdk` (keyboard nav +
 * listbox a11y) with filtering driven manually so dynamic API results and the
 * static command list can coexist. Styling lives in index.css ([cmdk-*] hooks).
 */
export function CommandPalette({ open, onOpenChange, mode, setMode }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const q = query.trim();

  // Global Ctrl/⌘K toggle + the "open from elsewhere" event.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    const openIt = () => onOpenChange(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, openIt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, openIt);
    };
  }, [open, onOpenChange]);

  // Reset the query whenever the palette opens so it starts blank.
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // Debounce the server-searched groups (scenarios, runs) so we don't fire on
  // every keystroke; static groups filter instantly against `q`.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(q), 180);
    return () => window.clearTimeout(id);
  }, [q]);

  const searchEnabled = open && debounced.length >= 2;
  const scenarioSearch = useQuery({
    queryKey: ["palette-scenarios", debounced],
    queryFn: () => qtp.testsPage({ name: debounced, page_size: 6, sort: "name", order: "asc" }),
    enabled: searchEnabled,
    staleTime: 15_000,
  });
  const runSearch = useQuery({
    queryKey: ["palette-runs", debounced],
    queryFn: () => qtp.runsPage({ test: debounced, page_size: 6, sort: "last_run_at", order: "desc" }),
    enabled: searchEnabled,
    staleTime: 15_000,
  });

  const pages = useMemo(() => PAGES.filter((p) => matches(`${p.label} ${p.keywords}`, q)), [q]);
  const docs = useMemo(
    () => (q ? DOC_SECTIONS.filter((s) => matches(s.title, q)).slice(0, 6) : []),
    [q],
  );

  const actions: (StaticCommand & { id: string; run: () => void })[] = useMemo(() => {
    const dark = mode === "dark";
    return [
      {
        id: "toggle-theme",
        label: dark ? "Switch to light mode" : "Switch to dark mode",
        keywords: "theme dark light mode appearance toggle",
        icon: dark ? <SunOutlined /> : <MoonOutlined />,
        run: () => setMode(dark ? "light" : "dark"),
      },
      {
        id: "logout",
        label: "Log out",
        keywords: "sign out exit logout session",
        icon: <LogoutOutlined />,
        run: () => keycloak.logout({ redirectUri: window.location.origin }),
      },
    ].filter((a) => matches(`${a.label} ${a.keywords}`, q));
  }, [mode, setMode, q]);

  const runAndClose = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };
  const go = (to: string) => runAndClose(() => navigate(to));

  const scenarios = scenarioSearch.data?.items ?? [];
  const runs = runSearch.data?.items ?? [];
  const searching = searchEnabled && (scenarioSearch.isFetching || runSearch.isFetching);
  const nothing =
    pages.length === 0 && actions.length === 0 && docs.length === 0 &&
    scenarios.length === 0 && runs.length === 0 && !searching;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      shouldFilter={false}
      overlayClassName="qtp-cmdk-overlay"
      contentClassName="qtp-cmdk-content"
      loop
    >
      <div className="qtp-cmdk-input-row">
        <Command.Input
          value={query}
          onValueChange={setQuery}
          autoFocus
          placeholder="Search pages, scenarios, runs, docs…"
        />
        <kbd className="qtp-cmdk-esc">esc</kbd>
      </div>
      <Command.List>
        {nothing && <Command.Empty>No results found.</Command.Empty>}

        {pages.length > 0 && (
          <Command.Group heading="Pages">
            {pages.map((p) => (
              <Command.Item key={p.to} value={`page:${p.to}`} onSelect={() => go(p.to)}>
                <span className="qtp-cmdk-icon">{p.icon}</span>
                <span className="qtp-cmdk-label">{p.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {actions.length > 0 && (
          <Command.Group heading="Actions">
            {actions.map((a) => (
              <Command.Item key={a.id} value={`action:${a.id}`} onSelect={() => runAndClose(a.run)}>
                <span className="qtp-cmdk-icon">{a.icon}</span>
                <span className="qtp-cmdk-label">{a.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {scenarios.length > 0 && (
          <Command.Group heading="Scenarios">
            {scenarios.map((s) => (
              <Command.Item
                key={s.id}
                value={`scenario:${s.id}`}
                onSelect={() => go(`/scenarios/${s.id}`)}
              >
                <span className="qtp-cmdk-icon"><ExperimentOutlined /></span>
                <span className="qtp-cmdk-label">{s.name}</span>
                <span className="qtp-cmdk-meta">{s.target_key}</span>
                {s.last_run_status && <StatusTag status={s.last_run_status} />}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {runs.length > 0 && (
          <Command.Group heading="Runs">
            {runs.map((r) => (
              <Command.Item key={r.id} value={`run:${r.id}`} onSelect={() => go(`/runs/${r.id}`)}>
                <span className="qtp-cmdk-icon"><PlayCircleOutlined /></span>
                <span className="qtp-cmdk-label">{r.test_name || "Run"}</span>
                <span className="qtp-cmdk-meta">#{r.id.slice(0, 8)}</span>
                <StatusTag status={r.status} />
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {docs.length > 0 && (
          <Command.Group heading="Docs">
            {docs.map((s) => (
              <Command.Item
                key={s.id}
                value={`doc:${s.id}`}
                onSelect={() => go(`/docs#${s.id}`)}
              >
                <span className="qtp-cmdk-icon"><FileTextOutlined /></span>
                <span className="qtp-cmdk-label">{s.title}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {searching && <div className="qtp-cmdk-searching">Searching…</div>}
      </Command.List>
    </Command.Dialog>
  );
}
