import { tokens, type Mode } from "./tokens";

/**
 * Emits the CSS custom properties that index.css and components read via
 * var(--qtp-*). Keeping the legacy variable names means existing markup keeps
 * working while all values now flow from tokens.ts (single source of truth).
 */
export function cssVars(mode: Mode): Record<string, string> {
  const t = tokens[mode];
  return {
    "--qtp-content-bg": t.bg.app,
    "--qtp-surface-bg": t.bg.surface,
    "--qtp-surface": t.bg.surface,
    "--qtp-subtle-bg": t.bg.subtle,
    "--qtp-surface-border": t.border.subtle,
    "--qtp-surface-border-strong": t.border.strong,
    "--qtp-surface-shadow": t.shadow.sm,
    "--qtp-surface-shadow-hover": t.shadow.overlay,
    "--qtp-code-bg": t.bg.subtle,
    "--qtp-code-border": t.border.subtle,
    "--qtp-sidebar-bg": t.bg.sidebar,
    "--qtp-header-border": t.border.subtle,
    "--qtp-scroll-thumb": mode === "dark" ? "rgba(120, 128, 140, 0.45)" : "rgba(148, 163, 184, 0.5)",

    "--qtp-brand": t.brand.solid,
    "--qtp-brand-hover": t.brand.hover,
    "--qtp-brand-tint": t.brand.tint,

    "--qtp-text": t.text.primary,
    "--qtp-text-secondary": t.text.secondary,
    "--qtp-text-tertiary": t.text.tertiary,

    "--qtp-status-pass": t.status.pass,
    "--qtp-status-fail": t.status.fail,
    "--qtp-status-error": t.status.error,
    "--qtp-status-timeout": t.status.timeout,
    "--qtp-status-running": t.status.running,
    "--qtp-status-queued": t.status.queued,
    "--qtp-status-neutral": t.status.neutral,
  };
}

/** Apply the CSS variables for the given mode to the document root. */
export function applyCssVars(mode: Mode): void {
  const root = document.documentElement;
  const vars = cssVars(mode);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
}
