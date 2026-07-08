import { Avatar, Card, Col, Descriptions, Empty, Row, Space, Statistic, Table, Tag, Typography } from "antd";
import { CrownOutlined, UserOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { qtp } from "../api/qtp";
import { Duration, StatusTag } from "../components/tags";
import { formatLocalTime } from "../components/tags";

function displayDate(value?: string) {
  return value ? formatLocalTime(value) : "—";
}

export default function ProfilePage() {
  const nav = useNavigate();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: qtp.me });
  const { data: runsPage, isLoading } = useQuery({
    queryKey: ["profileRuns", me?.username],
    queryFn: () => qtp.runsPage({
      page: 1,
      page_size: 8,
      sort: "queued_at",
      order: "desc",
      triggered_by: me?.username,
    }),
    enabled: !!me?.username,
  });
  const roles = me?.roles || [];
  const recentRuns = runsPage?.items || [];

  return (
    <div className="qtp-page">
      <Space className="qtp-page-heading" align="center" wrap>
        <Avatar size={56} icon={<UserOutlined />} />
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>{me?.username || "User profile"}</Typography.Title>
          <Typography.Text type="secondary">{me?.email || "No email address available"}</Typography.Text>
        </div>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card className="qtp-surface" title="Account">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Username">{me?.username || "—"}</Descriptions.Item>
              <Descriptions.Item label="Email">{me?.email || "—"}</Descriptions.Item>
              <Descriptions.Item label="Subject">
                <Typography.Text code>{me?.subject || "—"}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Admin">{me?.is_admin ? "Yes" : "No"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="qtp-surface" title="Roles">
            <Space wrap>
              {roles.length ? roles.map((role) => (
                <Tag key={role} icon={role === "qtp_admin" ? <CrownOutlined /> : undefined} color={role === "qtp_admin" ? "gold" : "blue"}>
                  {role}
                </Tag>
              )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No roles" />}
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Row gutter={[12, 12]}>
            <Col span={12}>
              <Card className="qtp-kpi qtp-surface">
                <Statistic title="Recent runs" value={runsPage?.total || 0} />
              </Card>
            </Col>
            <Col span={12}>
              <Card className="qtp-kpi qtp-surface">
                <Statistic title="Roles" value={roles.length} />
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      <Card className="qtp-surface" title="Recent executions" style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={recentRuns}
          locale={{ emptyText: <Empty description="No executions recorded for this user" /> }}
          pagination={false}
          onRow={(r) => ({ onClick: () => nav(`/runs/${r.id}`), style: { cursor: "pointer" } })}
          columns={[
            { title: "Test", dataIndex: "test_name", render: (v) => v || <em>—</em> },
            { title: "Status", dataIndex: "status", render: (s) => <StatusTag status={s} /> },
            { title: "Target", dataIndex: "target_key", render: (v) => v || "—" },
            { title: "Duration", dataIndex: "duration_ms", render: (m) => <Duration ms={m} /> },
            { title: "Queued", dataIndex: "queued_at", render: displayDate },
          ]}
        />
      </Card>
    </div>
  );
}
