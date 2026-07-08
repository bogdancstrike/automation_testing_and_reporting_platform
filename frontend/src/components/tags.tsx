import type { CSSProperties, ReactNode } from "react";

/** Shared pill primitive: a tinted rounded label with a leading status dot. */
function Pill({ color, children, live }: { color: string; children: ReactNode; live?: boolean }) {
  return (
    <span className={`qtp-pill${live ? " qtp-pill--live" : ""}`} style={{ "--pill": color } as CSSProperties}>
      <span className="qtp-pill-dot" />
      {children}
    </span>
  );
}

const RUN_META: Record<string, { color: string; label: string; live?: boolean }> = {
  passed: { color: "#16a34a", label: "Passed" },
  failed: { color: "#dc2626", label: "Failed" },
  error: { color: "#ea580c", label: "Error" },
  timeout: { color: "#d97706", label: "Timeout" },
  canceled: { color: "#64748b", label: "Canceled" },
  skipped: { color: "#64748b", label: "Skipped" },
  running: { color: "#2563eb", label: "Running", live: true },
  claimed: { color: "#2563eb", label: "Claimed", live: true },
  preparing: { color: "#2563eb", label: "Preparing", live: true },
  queued: { color: "#0891b2", label: "Queued", live: true },
};

export function StatusTag({ status }: { status?: string }) {
  if (!status) return <span className="qtp-pill qtp-pill--plain" style={{ "--pill": "#94a3b8" } as CSSProperties}>—</span>;
  const m = RUN_META[status] || { color: "#64748b", label: status };
  return <Pill color={m.color} live={m.live}>{m.label}</Pill>;
}

const DEFECT_META: Record<string, { color: string; label: string }> = {
  product_bug: { color: "#dc2626", label: "Product bug" },
  automation_bug: { color: "#d97706", label: "Automation bug" },
  system_issue: { color: "#9333ea", label: "System issue" },
  to_investigate: { color: "#2563eb", label: "To investigate" },
  no_defect: { color: "#16a34a", label: "No defect" },
};

export function DefectTag({ defect }: { defect?: string }) {
  if (!defect) return <Pill color="#94a3b8">Untriaged</Pill>;
  const m = DEFECT_META[defect] || { color: "#64748b", label: defect.replace(/_/g, " ") };
  return <Pill color={m.color}>{m.label}</Pill>;
}

const TYPE_META: Record<string, { color: string; label: string }> = {
  http_request: { color: "#2563eb", label: "HTTP" },
  python_script: { color: "#0891b2", label: "Python" },
  playwright: { color: "#db2777", label: "Playwright" },
  selenium: { color: "#9333ea", label: "Selenium" },
  cli: { color: "#d97706", label: "CLI" },
};

export function TypeTag({ type }: { type: string }) {
  const m = TYPE_META[type] || { color: "#64748b", label: type };
  return <Pill color={m.color}>{m.label}</Pill>;
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(2)} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  let res = `${hours}h`;
  if (remainingMinutes > 0) res += ` ${remainingMinutes}m`;
  if (seconds > 0) res += ` ${seconds}s`;
  return res;
}

export function Duration({ ms }: { ms?: number | null }) {
  if (ms === null || ms === undefined) return <span>—</span>;
  return <span>{formatDurationMs(ms)}</span>;
}
