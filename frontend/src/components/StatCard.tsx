import type { CSSProperties, ReactNode } from "react";
import { Card, Statistic } from "antd";

type StatCardProps = {
  label: string;
  value: number | string;
  icon: ReactNode;
  /** Accent colour for the icon chip (and optionally the value). */
  accent?: string;
  suffix?: ReactNode;
  precision?: number;
  hint?: ReactNode;
  formatter?: (value: number | string) => ReactNode;
  /** When true, the value is tinted with the accent colour. */
  tintValue?: boolean;
  /** When provided, the whole card becomes a button (cursor + hover) that runs this. */
  onClick?: () => void;
};

/**
 * Enterprise KPI tile: a tinted icon chip beside a labelled metric. Wraps AntD
 * `Statistic` for number formatting while giving the dashboard a consistent,
 * modern card language (see `.qtp-statcard` in index.css for hover/elevation).
 */
export function StatCard({
  label, value, icon, accent = "#2563eb", suffix, precision, hint, formatter, tintValue, onClick,
}: StatCardProps) {
  return (
    <Card
      className="qtp-statcard"
      styles={{ body: { padding: 16 } }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <div className="qtp-statcard-row">
        <div
          className="qtp-statcard-icon"
          style={{ color: accent, background: `color-mix(in srgb, ${accent} 13%, transparent)` }}
        >
          {icon}
        </div>
        <div className="qtp-statcard-main">
          <div className="qtp-statcard-label">{label}</div>
          <Statistic
            value={value}
            precision={precision}
            suffix={suffix}
            formatter={formatter as never}
            valueStyle={{
              fontSize: 24,
              fontWeight: 700,
              lineHeight: 1.15,
              ...(tintValue ? { color: accent } : {}),
            } as CSSProperties}
          />
          {hint != null && <div className="qtp-statcard-hint">{hint}</div>}
        </div>
      </div>
    </Card>
  );
}
