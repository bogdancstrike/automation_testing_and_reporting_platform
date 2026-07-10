import * as echarts from "echarts";
import { tokens, type Mode } from "./tokens";

/**
 * ECharts option fragment derived from tokens, so charts share the product's
 * palette (one "passed" green, one "failed" red) and adapt to dark mode.
 * Spread this into an option, or deep-merge for axis/grid defaults.
 * See docs/migrate_UI.md §6.5.
 */
export function chartTheme(mode: Mode) {
  const t = tokens[mode];
  const axisLine = { lineStyle: { color: t.border.subtle } };
  const splitLine = { lineStyle: { color: t.border.subtle, type: "dashed" as const } };
  const axisLabel = { color: t.text.tertiary, fontSize: 11 };

  return {
    color: [
      t.status.running,
      t.status.pass,
      t.status.fail,
      t.status.timeout,
      t.status.error,
      t.status.queued,
      t.status.violet,
      t.status.neutral,
    ],
    textStyle: { color: t.text.secondary, fontFamily: "'Inter Variable', Inter, sans-serif" },
    grid: { left: 44, right: 20, top: 32, bottom: 30, containLabel: true },
    legend: {
      textStyle: { color: t.text.secondary, fontSize: 12 },
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 10,
      top: 4,
    },
    tooltip: {
      backgroundColor: t.bg.surface,
      borderColor: t.border.subtle,
      borderWidth: 1,
      textStyle: { color: t.text.primary, fontSize: 12 },
      extraCssText: `box-shadow: ${t.shadow.overlay}; border-radius: 8px;`,
    },
    categoryAxis: { axisLine, axisTick: { show: false }, axisLabel, splitLine: { show: false } },
    valueAxis: { axisLine: { show: false }, axisTick: { show: false }, axisLabel, splitLine },
  };
}

/** Theme names registered with ECharts; use via the `theme` prop. */
export const chartThemeName = (mode: Mode) => (mode === "dark" ? "qtp-dark" : "qtp-light");

echarts.registerTheme("qtp-light", chartTheme("light"));
echarts.registerTheme("qtp-dark", chartTheme("dark"));

/** Status → chart colour, matching the badges. */
export function chartStatusColor(mode: Mode, status: string): string {
  const s = tokens[mode].status;
  const map: Record<string, string> = {
    passed: s.pass,
    failed: s.fail,
    error: s.error,
    timeout: s.timeout,
    running: s.running,
    queued: s.queued,
  };
  return map[status] ?? s.neutral;
}
