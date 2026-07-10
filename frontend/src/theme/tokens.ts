/**
 * QTP design tokens — the single source of truth for colour, elevation, radius,
 * and type. Consumed by:
 *   - antdTheme.ts   → AntD ConfigProvider
 *   - cssVars.ts     → CSS custom properties on <html> (index.css reads var(--qtp-*))
 *   - chartTheme.ts  → ECharts theme
 *
 * Decisions (docs/migrate_UI.md §12): indigo accent, neutral near-black dark,
 * Inter + JetBrains Mono, rounded-rect status badges.
 */

export type Mode = "light" | "dark";

export interface StatusColors {
  pass: string;
  fail: string;
  error: string;
  timeout: string;
  running: string;
  queued: string;
  neutral: string;
  violet: string; // system issues / special
}

export interface ThemeTokens {
  brand: { solid: string; hover: string; tint: string; border: string };
  bg: { app: string; surface: string; subtle: string; hover: string; sidebar: string };
  border: { subtle: string; strong: string };
  text: { primary: string; secondary: string; tertiary: string; onBrand: string };
  status: StatusColors;
  shadow: { sm: string; overlay: string };
}

const radius = { sm: 6, md: 8, lg: 10 } as const;

const fontSans =
  "'Inter Variable', Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const fontMono =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

const light: ThemeTokens = {
  brand: { solid: "#4f46e5", hover: "#4338ca", tint: "#eef2ff", border: "#c7cbf5" },
  bg: { app: "#f7f8fa", surface: "#ffffff", subtle: "#f2f4f7", hover: "#f1f2f4", sidebar: "#12141a" },
  border: { subtle: "#e7e9ee", strong: "#d5d9e0" },
  text: { primary: "#191b21", secondary: "#5a6472", tertiary: "#8b93a1", onBrand: "#ffffff" },
  status: {
    pass: "#16a34a",
    fail: "#e5484d",
    error: "#ea580c",
    timeout: "#d97706",
    running: "#4f46e5",
    queued: "#0891b2",
    neutral: "#64748b",
    violet: "#9333ea",
  },
  shadow: {
    sm: "0 1px 2px rgba(16, 24, 40, 0.06)",
    overlay: "0 8px 24px rgba(16, 24, 40, 0.12)",
  },
};

const dark: ThemeTokens = {
  brand: { solid: "#6366f1", hover: "#7c7cf0", tint: "rgba(99, 102, 241, 0.16)", border: "rgba(99, 102, 241, 0.38)" },
  bg: { app: "#0b0c0e", surface: "#151619", subtle: "#1c1e22", hover: "#222429", sidebar: "#0e0f12" },
  border: { subtle: "#26292e", strong: "#34383f" },
  text: { primary: "#e7e9ec", secondary: "#9aa1ab", tertiary: "#6b7280", onBrand: "#ffffff" },
  status: {
    pass: "#3fb950",
    fail: "#f76c6c",
    error: "#fb8c3d",
    timeout: "#f0a92c",
    running: "#6366f1",
    queued: "#2bb8cf",
    neutral: "#8b93a1",
    violet: "#a855f7",
  },
  shadow: {
    sm: "0 1px 2px rgba(0, 0, 0, 0.4)",
    overlay: "0 8px 24px rgba(0, 0, 0, 0.55)",
  },
};

export const tokens: Record<Mode, ThemeTokens> = { light, dark };

export const scale = { radius, fontSans, fontMono };

/**
 * Shared status palette used by badges *and* charts, so a "passed" green is the
 * same everywhere. Keyed by run status / defect concept.
 */
export function statusColor(mode: Mode, key: string): string {
  const s = tokens[mode].status;
  const map: Record<string, keyof StatusColors> = {
    passed: "pass",
    pass: "pass",
    failed: "fail",
    fail: "fail",
    error: "error",
    timeout: "timeout",
    warning: "timeout",
    running: "running",
    claimed: "running",
    preparing: "running",
    queued: "queued",
    canceled: "neutral",
    cancelled: "neutral",
    skipped: "neutral",
    // defect types
    product_bug: "fail",
    automation_bug: "timeout",
    system_issue: "violet",
    to_investigate: "running",
    no_defect: "pass",
  };
  return s[map[key] ?? "neutral"];
}
