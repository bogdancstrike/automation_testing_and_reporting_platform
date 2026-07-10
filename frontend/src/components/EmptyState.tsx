import type { ReactNode } from "react";
import { InboxOutlined } from "@ant-design/icons";

/**
 * Themed empty state — a tinted line icon + title + optional hint/action.
 * Replaces AntD's default gray illustration (which clashes in dark mode).
 * See docs/migrate_UI.md §6.6.
 */
export function EmptyState({
  icon,
  title = "No data",
  hint,
  action,
  compact,
}: {
  icon?: ReactNode;
  title?: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`qtp-empty${compact ? " qtp-empty--compact" : ""}`}>
      <div className="qtp-empty-icon">{icon ?? <InboxOutlined />}</div>
      <div className="qtp-empty-title">{title}</div>
      {hint && <div className="qtp-empty-hint">{hint}</div>}
      {action && <div className="qtp-empty-action">{action}</div>}
    </div>
  );
}
