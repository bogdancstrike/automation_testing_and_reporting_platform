import { useState } from "react";
import { Layout, Menu, Dropdown, Avatar, Typography, theme } from "antd";
import {
  DashboardOutlined, ExperimentOutlined, SendOutlined, PlayCircleOutlined,
  ClockCircleOutlined, AimOutlined, ClusterOutlined, BookOutlined,
  UserOutlined, LogoutOutlined,
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

const { Header, Sider, Content } = Layout;

const NAV = [
  { key: "/", icon: <DashboardOutlined />, label: "Overview" },
  { key: "/tests", icon: <ExperimentOutlined />, label: "Test Catalog" },
  { key: "/request-builder", icon: <SendOutlined />, label: "Request Builder" },
  { key: "/runs", icon: <PlayCircleOutlined />, label: "Runs" },
  { key: "/schedules", icon: <ClockCircleOutlined />, label: "Schedules" },
  { key: "/targets", icon: <AimOutlined />, label: "Targets" },
  { key: "/workers", icon: <ClusterOutlined />, label: "Workers" },
  { key: "/docs", icon: <BookOutlined />, label: "Developer Docs" },
];

export default function QtpApp() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: qtp.me });

  const selectedKey =
    NAV.map((n) => n.key)
      .filter((k) => k === "/" ? location.pathname === "/" : location.pathname.startsWith(k))
      .sort((a, b) => b.length - a.length)[0] || "/";

  return (
    <Layout className="qtp-shell">
      <Sider className="qtp-sider" collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark">
        <div className="qtp-logo">{collapsed ? "QTP" : "QSINT · QTP"}</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={NAV}
          onClick={(e) => navigate(e.key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: token.colorBgContainer, display: "flex",
          alignItems: "center", justifyContent: "flex-end", paddingInline: 20 }}>
          <Dropdown
            menu={{
              items: [
                { key: "who", label: `${me?.username || "…"} (${(me?.roles || []).join(", ") || "—"})`, disabled: true },
                { type: "divider" },
                { key: "logout", icon: <LogoutOutlined />, label: "Log out",
                  onClick: () => keycloak.logout({ redirectUri: window.location.origin }) },
              ],
            }}
          >
            <span style={{ cursor: "pointer" }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ marginRight: 8 }} />
              <Typography.Text strong>{me?.username || "user"}</Typography.Text>
            </span>
          </Dropdown>
        </Header>
        <Content className="qtp-content">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/tests" element={<CatalogPage />} />
            <Route path="/tests/:id" element={<TestDetailPage />} />
            <Route path="/request-builder" element={<RequestBuilderPage />} />
            <Route path="/runs" element={<RunsPage />} />
            <Route path="/runs/:id" element={<RunDetailPage />} />
            <Route path="/schedules" element={<SchedulesPage />} />
            <Route path="/schedules/:id" element={<ScheduleDetailPage />} />
            <Route path="/targets" element={<TargetsPage />} />
            <Route path="/targets/:id" element={<TargetDetailPage />} />
            <Route path="/workers" element={<WorkersPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}
