import { theme, type ThemeConfig } from "antd";
import { tokens, scale, type Mode } from "./tokens";

/**
 * Builds the AntD ConfigProvider theme from design tokens. Denser than AntD's
 * defaults (13px base, 34px controls, border-first elevation) to read like
 * Linear/Datadog. See docs/migrate_UI.md §3.5.
 */
export function buildAntdTheme(mode: Mode): ThemeConfig {
  const t = tokens[mode];
  const dark = mode === "dark";
  return {
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: t.brand.solid,
      colorInfo: t.brand.solid,
      colorSuccess: t.status.pass,
      colorError: t.status.fail,
      colorWarning: t.status.timeout,
      colorLink: t.brand.solid,
      colorLinkHover: t.brand.hover,

      colorBgLayout: t.bg.app,
      colorBgContainer: t.bg.surface,
      colorBgElevated: t.bg.surface,
      colorBorder: t.border.strong,
      colorBorderSecondary: t.border.subtle,
      colorText: t.text.primary,
      colorTextSecondary: t.text.secondary,
      colorTextTertiary: t.text.tertiary,

      borderRadius: scale.radius.md,
      borderRadiusLG: scale.radius.lg,
      borderRadiusSM: scale.radius.sm,
      wireframe: false,

      fontFamily: scale.fontSans,
      fontFamilyCode: scale.fontMono,
      fontSize: 13,
      controlHeight: 34,

      boxShadow: t.shadow.sm,
      boxShadowSecondary: t.shadow.sm,
      boxShadowTertiary: t.shadow.sm,
    },
    components: {
      Layout: {
        headerHeight: 64,
        headerPadding: "0 20px",
        headerBg: t.bg.surface,
        bodyBg: "transparent",
      },
      Menu: {
        itemBorderRadius: 8,
        itemMarginInline: 8,
        itemHeight: 38,
        darkItemBg: "transparent",
        darkSubMenuItemBg: "transparent",
        darkItemSelectedBg: dark ? "rgba(99, 102, 241, 0.22)" : "rgba(99, 102, 241, 0.24)",
        darkItemHoverBg: "rgba(255, 255, 255, 0.06)",
        darkItemColor: "rgba(233, 236, 239, 0.68)",
        darkItemSelectedColor: "#ffffff",
      },
      Card: {
        borderRadiusLG: scale.radius.lg,
        paddingLG: 16,
      },
      Table: {
        headerBg: t.bg.subtle,
        headerColor: t.text.secondary,
        headerSplitColor: "transparent",
        rowHoverBg: t.brand.tint,
        cellPaddingBlock: 8,
        borderColor: t.border.subtle,
        headerBorderRadius: scale.radius.md,
      },
      Button: {
        fontWeight: 500,
        primaryShadow: "none",
        defaultShadow: "none",
      },
      Segmented: {
        trackBg: t.bg.subtle,
      },
      Tabs: {
        horizontalItemGutter: 20,
      },
      Statistic: {
        titleFontSize: 12,
      },
      Tooltip: {
        colorBgSpotlight: dark ? "#2b2e33" : "#191b21",
      },
    },
  };
}
