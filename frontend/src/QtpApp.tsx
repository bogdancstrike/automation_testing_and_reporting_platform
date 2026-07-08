import { useEffect, useMemo, useState } from "react";
import { App as AntApp, Avatar, Button, ConfigProvider, Dropdown, Layout, Menu, Space, Tooltip, Typography, theme } from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined, ExperimentOutlined, SendOutlined, PlayCircleOutlined,
  ClockCircleOutlined, AimOutlined, ClusterOutlined, BookOutlined,
  UserOutlined, LogoutOutlined, MoonOutlined, SunOutlined,
} from "@ant-design/icons";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { keycloak } from "./keycloak";
import { qtp } from "./api/qtp";
import OverviewPage from "./pages/OverviewPage";
import CatalogPage from "./pages/CatalogPage";
import TestDetailPage from "./pages/TestDetailPage";
import RequestBuilderPage from "./pages/RequestBuilderPage";
import RunsPage from "./pages/RunsPage";
import RunDetailPage from "./pages/RunDetailPage";
import SchedulesPage from "./pages/SchedulesPage";
import ScheduleDetailPage from "./pages/ScheduleDetailPage";
import TargetsPage from "./pages/TargetsPage";
import TargetDetailPage from "./pages/TargetDetailPage";
import WorkersPage from "./pages/WorkersPage";
import DocsPage from "./pages/DocsPage";
import ProfilePage from "./pages/ProfilePage";

const { Header, Sider, Content } = Layout;

const NAV_GROUPS = [
  {
    key: "monitor",
    label: "Monitor",
    children: [
      { key: "/overview", icon: <DashboardOutlined />, label: "Overview" },
      { key: "/runs", icon: <PlayCircleOutlined />, label: "Runs" },
      { key: "/schedules", icon: <ClockCircleOutlined />, label: "Schedules" },
    ],
  },
  {
    key: "test-design",
    label: "Test Design",
    children: [
      { key: "/scenarios", icon: <ExperimentOutlined />, label: "Scenarios" },
      { key: "/request-builder", icon: <SendOutlined />, label: "Request Builder" },
    ],
  },
  {
    key: "assets",
    label: "Assets",
    children: [
      { key: "/targets", icon: <AimOutlined />, label: "Targets" },
      { key: "/workers", icon: <ClusterOutlined />, label: "Workers" },
    ],
  },
  {
    key: "knowledge",
    label: "Knowledge",
    children: [
      { key: "/docs", icon: <BookOutlined />, label: "Developer Docs" },
    ],
  },
];

const NAV = NAV_GROUPS.flatMap((group) => group.children);

const PAGE_META: Record<string, string> = {
  "/overview": "Operational metrics and recent activity",
  "/runs": "Execution history across every scenario",
  "/schedules": "Automated run triggers and cadences",
  "/scenarios": "Test definitions, revisions, and discovery",
  "/request-builder": "No-code, multi-step HTTP scenario builder",
  "/targets": "Systems under test and their environments",
  "/workers": "Execution workers, capabilities, and health",
  "/docs": "Developer documentation and integration guides",
  "/profile": "Your account and access",
};

const THEME_STORAGE_KEY = "qtp-theme-mode";

type ThemeMode = "light" | "dark";

function storedTheme(): ThemeMode {
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
}

function AppShell({ mode, setMode }: { mode: ThemeMode; setMode: (mode: ThemeMode) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: qtp.me });

  const selectedKey =
    NAV.map((n) => n.key)
      .filter((k) => location.pathname.startsWith(k))
      .sort((a, b) => b.length - a.length)[0] || "/overview";
  const darkMode = mode === "dark";
  const menuItems: MenuProps["items"] = NAV_GROUPS.map((group) => ({
    type: "group",
    key: group.key,
    label: collapsed ? "" : group.label,
    children: group.children,
  }));

  return (
    <Layout className="qtp-shell" data-theme={mode}>
      <Sider className="qtp-sider" collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark" width={248}>
        <div className="qtp-logo">
          <span className="qtp-logo-mark">Q</span>
          {!collapsed && (
            <span>
              <strong>Quality</strong>
              <small>Testing Platform</small>
            </span>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={(e) => navigate(e.key)}
        />
      </Sider>
      <Layout>
        <Header className="qtp-header" style={{ background: token.colorBgContainer }}>
          <div className="qtp-header-title">
            <Typography.Text strong style={{ fontSize: 16 }}>
              {NAV.find((n) => n.key === selectedKey)?.label || "Overview"}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
              {PAGE_META[selectedKey] || "Automation testing control plane"}
            </Typography.Text>
          </div>
          <Space size={10}>
            <Tooltip title={darkMode ? "Switch to light mode" : "Switch to dark mode"}>
              <Button
                aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                shape="circle"
                icon={darkMode ? <SunOutlined /> : <MoonOutlined />}
                onClick={() => setMode(darkMode ? "light" : "dark")}
              />
            </Tooltip>
          <Dropdown
            menu={{
              items: [
                { key: "who", label: `${me?.username || "…"} (${(me?.roles || []).join(", ") || "—"})`, disabled: true },
                { key: "profile", icon: <UserOutlined />, label: "Profile", onClick: () => navigate("/profile") },
                { type: "divider" },
                { key: "logout", icon: <LogoutOutlined />, label: "Log out",
                  onClick: () => keycloak.logout({ redirectUri: window.location.origin }) },
              ],
            }}
          >
            <span className="qtp-user-menu">
              <Avatar size="small" icon={<UserOutlined />} style={{ marginRight: 8 }} />
              <Typography.Text strong>{me?.username || "user"}</Typography.Text>
            </span>
          </Dropdown>
          </Space>
        </Header>
        <Content className="qtp-content">
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/tests" element={<Navigate to="/scenarios" replace />} />
            <Route path="/tests/:id" element={<NavigateToScenario />} />
            <Route path="/scenarios" element={<CatalogPage />} />
            <Route path="/scenarios/:id" element={<TestDetailPage />} />
            <Route path="/request-builder" element={<RequestBuilderPage />} />
            <Route path="/runs" element={<RunsPage />} />
            <Route path="/runs/:id" element={<RunDetailPage />} />
            <Route path="/schedules" element={<SchedulesPage />} />
            <Route path="/schedules/:id" element={<ScheduleDetailPage />} />
            <Route path="/targets" element={<TargetsPage />} />
            <Route path="/targets/:id" element={<TargetDetailPage />} />
            <Route path="/workers" element={<WorkersPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

function NavigateToScenario() {
  const location = useLocation();
  const parts = location.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 1];
  return <Navigate to={id ? `/scenarios/${id}` : "/scenarios"} replace />;
}

export default function QtpApp() {
  const [mode, setMode] = useState<ThemeMode>(storedTheme);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const appTheme = useMemo(() => {
    const dark = mode === "dark";
    return {
      algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        colorPrimary: "#2563eb",
        colorInfo: "#2563eb",
        colorSuccess: "#16a34a",
        colorError: "#dc2626",
        colorWarning: "#d97706",
        borderRadius: 8,
        borderRadiusLG: 12,
        borderRadiusSM: 6,
        wireframe: false,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
        fontSize: 14,
        controlHeight: 36,
        colorBgLayout: dark ? "#0b1220" : "#f5f7fb",
        boxShadowSecondary: dark
          ? "0 6px 20px rgba(0, 0, 0, 0.45)"
          : "0 6px 20px rgba(15, 23, 42, 0.06)",
      },
      components: {
        Layout: {
          headerHeight: 64,
          headerPadding: "0 20px",
          headerBg: dark ? "#0f172a" : "#ffffff",
          bodyBg: "transparent",
        },
        Menu: {
          itemBorderRadius: 8,
          itemMarginInline: 8,
          itemHeight: 40,
          darkItemBg: "transparent",
          darkSubMenuItemBg: "transparent",
          darkItemSelectedBg: "rgba(37, 99, 235, 0.20)",
          darkItemHoverBg: "rgba(148, 163, 184, 0.10)",
          darkItemColor: "rgba(226, 232, 240, 0.72)",
          darkItemSelectedColor: "#ffffff",
        },
        Card: {
          borderRadiusLG: 12,
          paddingLG: 20,
        },
        Table: {
          headerBg: dark ? "#111827" : "#f8fafc",
          headerColor: dark ? "#94a3b8" : "#475569",
          headerSplitColor: "transparent",
          rowHoverBg: dark ? "rgba(37, 99, 235, 0.10)" : "rgba(37, 99, 235, 0.04)",
          cellPaddingBlock: 12,
          borderColor: dark ? "#1f2937" : "#eef2f7",
        },
        Button: {
          fontWeight: 500,
          primaryShadow: "none",
          defaultShadow: "none",
        },
        Segmented: {
          trackBg: dark ? "#1e293b" : "#eef2f7",
        },
        Statistic: {
          titleFontSize: 13,
        },
      },
    };
  }, [mode]);

  return (
    <ConfigProvider theme={appTheme}>
      <AntApp>
        <AppShell mode={mode} setMode={setMode} />
      </AntApp>
    </ConfigProvider>
  );
}
