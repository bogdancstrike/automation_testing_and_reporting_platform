import { Card, Descriptions, Typography, Space, Button, Table, Tag, Row, Col, Switch, App } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qtp } from "../api/qtp";
import { StatusTag } from "../components/tags";

export default function ScheduleDetailPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();

  const { data: s } = useQuery({ queryKey: ["schedule", id], queryFn: () => qtp.schedule(id) });
  const { data: runsPage } = useQuery({ queryKey: ["runs", "bySchedule", id], queryFn: () => qtp.runs(`?schedule_id=${id}`) });

  const toggle = useMutation({
    mutationFn: () => qtp.updateSchedule(id, { is_enabled: !s?.is_enabled }),
    onSuccess: () => {
      message.success("Schedule updated");
      qc.invalidateQueries({ queryKey: ["schedule", id] });
    }
  });

  if (!s) return null;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav("/schedules")}>Schedules</Button>
      </Space>

      <Typography.Title level={3}>{s.name}</Typography.Title>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="Schedule Details">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Status">
                <Space>
                  <Switch size="small" checked={s.is_enabled} onChange={() => toggle.mutate()} />
                  {s.is_enabled ? <Tag color="green">Active</Tag> : <Tag>Disabled</Tag>}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Recurrence">
                {s.recurrence_type === "cron" ? <Tag>cron: {s.cron_expression}</Tag> : s.recurrence_type === "interval" ? <Tag>every {s.interval_seconds}s</Tag> : <Tag>once</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Target">
                {s.target_keys?.length
                  ? s.target_keys.map((target: string) => <Tag key={target} color="geekblue">{target}</Tag>)
                  : s.target_key ? <Tag color="geekblue">{s.target_key}</Tag> : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Scenarios">
                {s.scenario_count || s.tests?.length || 1}
              </Descriptions.Item>
              <Descriptions.Item label="Environment">{s.environment}</Descriptions.Item>
              <Descriptions.Item label="Next Run At">{s.next_run_at?.replace("T", " ").slice(0, 19) || "—"}</Descriptions.Item>
              <Descriptions.Item label="Created">{s.created_at?.replace("T", " ").slice(0, 19)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card size="small" title="Execution Stats">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Total Runs">{s.total_runs}</Descriptions.Item>
              <Descriptions.Item label="Last Run Status">
                {s.last_run_status ? (
                  <a onClick={() => s.last_run_id && nav(`/runs/${s.last_run_id}`)}>
                    <StatusTag status={s.last_run_status} />
                  </a>
                ) : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Status Distribution">
                <Space wrap>
                  {s.status_counts && Object.entries(s.status_counts).map(([status, count]: [string, any]) => (
                    <Tag key={status}>
                      {status}: {count}
                    </Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Scheduled Scenarios" style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={s.tests?.length ? s.tests : [{ id: s.test_definition_id, name: s.test_name, key: s.test_definition_id, target_key: s.target_key }]}
          onRow={(scenario: any) => ({ onClick: () => nav(`/scenarios/${scenario.id}`), style: { cursor: "pointer" } })}
          columns={[
            { title: "Name", dataIndex: "name", render: (value, scenario: any) => <a>{value || scenario.id}</a> },
            { title: "Key", dataIndex: "key", render: (value) => <Typography.Text code>{value || "—"}</Typography.Text> },
            { title: "Type", dataIndex: "type", render: (value) => value ? <Tag>{value}</Tag> : "—" },
            { title: "Target", dataIndex: "target_key", render: (value) => value ? <Tag color="geekblue">{value}</Tag> : "—" },
            { title: "Status", dataIndex: "status", render: (value) => value ? <Tag>{value}</Tag> : "—" },
          ]}
        />
      </Card>

      <Card size="small" title="Recent Runs" style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          size="small"
          dataSource={runsPage || []}
          onRow={(r: any) => ({ onClick: () => nav(`/runs/${r.id}`), style: { cursor: "pointer" } })}
          columns={[
            { title: "Scenario", dataIndex: "test_name", render: (n, r: any) => n || r.test_definition_id },
            { title: "Status", dataIndex: "status", render: (st) => <StatusTag status={st} /> },
            { title: "Duration", dataIndex: "duration_ms", render: (ms) => ms != null ? `${ms} ms` : "—" },
            { title: "Defect", dataIndex: "defect_type", render: (d) => d || "—" },
            { title: "Queued", dataIndex: "queued_at", render: (v) => v?.replace("T", " ").slice(0, 19) },
          ]}
        />
      </Card>
    </div>
  );
}
