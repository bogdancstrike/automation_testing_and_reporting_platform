import type { ReactNode } from "react";
import { Breadcrumb, Space } from "antd";
import { Link } from "react-router-dom";

export type Crumb = { label: ReactNode; to?: string };

/**
 * One header pattern for every page: optional breadcrumb trail, a single page
 * title (+ optional inline tag), an optional subtitle, and a right-aligned slot
 * for page actions. Replaces the per-page `Typography.Title level={3}` blocks so
 * a title is never rendered twice. See docs/migrate_UI.md §4.1.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
  tag,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: Crumb[];
  tag?: ReactNode;
}) {
  return (
    <div className="qtp-page-header">
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb
          className="qtp-crumbs"
          items={breadcrumb.map((c) => ({
            title: c.to ? <Link to={c.to}>{c.label}</Link> : c.label,
          }))}
        />
      )}
      <div className="qtp-page-header-row">
        <div className="qtp-page-header-titles">
          <h1 className="qtp-page-title">
            {title}
            {tag}
          </h1>
          {subtitle && <div className="qtp-page-subtitle">{subtitle}</div>}
        </div>
        {actions && (
          <Space className="qtp-page-actions" wrap>
            {actions}
          </Space>
        )}
      </div>
    </div>
  );
}
