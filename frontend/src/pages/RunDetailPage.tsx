import { Card, Descriptions, Button, Typography, Table, Space, Tabs, App, Tag, Select, Row, Col } from "antd";
import { ArrowLeftOutlined, StopOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qtp } from "../api/qtp";
import { StatusTag, DefectTag, Duration } from "../components/tags";

const DEFECTS = ["product_bug", "automation_bug", "system_issue", "to_investigate", "no_defect"];

export default function RunDetailPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const active = (s?: string) => ["queued", "claimed", "running"].includes(s || "");
  const { data: run } = useQuery({
    queryKey: ["run", id], queryFn: () => qtp.run(id),
    refetchInterval: (q) => (active((q.state.data as any)?.status) ? 2000 : false),
  });
  const { data: logs = [] } = useQuery({ queryKey: ["runlogs", id, run?.status], queryFn: () => qtp.runLogs(id) });

  const cancel = useMutation({
    mutationFn: () => qtp.cancelRun(id),
    onSuccess: () => { message.success("Cancel requested"); qc.invalidateQueries({ queryKey: ["run", id] }); },
    onError: (e: any) => message.error(e.message),
  });
  const triage = useMutation({
    mutationFn: (d: string) => qtp.setDefect(id, d),
    onSuccess: () => { message.success("Defect set"); qc.invalidateQueries({ queryKey: ["run", id] }); },
    onError: (e: any) => message.error(e.message),
  });

  if (!run) return null;
  const failed = ["failed", "error", "timeout"].includes(run.status);
  const resp = run.response || {};

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav("/runs")}>Runs</Button>
        {active(run.status) && <Button danger icon={<StopOutlined />} loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel</Button>}
      </Space>
      <Typography.Title level={3}>
        {run.test_name || "Run"} <StatusTag status={run.status} />
      </Typography.Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Trigger">{run.trigger}</Descriptions.Item>
          <Descriptions.Item label="Target">{run.target_key || "—"}</Descriptions.Item>
          <Descriptions.Item label="Worker">{run.worker_name || "—"}</Descriptions.Item>
          <Descriptions.Item label="Duration"><Duration ms={run.duration_ms} /></Descriptions.Item>
          <Descriptions.Item label="Environment">{run.environment}</Descriptions.Item>
          <Descriptions.Item label="Queued">{run.queued_at?.replace("T", " ").slice(0, 19)}</Descriptions.Item>
          {failed && <Descriptions.Item label="Failure">{run.error_category}: {run.error_message}</Descriptions.Item>}
        </Descriptions>
        {failed && (
          <Space style={{ marginTop: 8 }}>
            <Typography.Text type="secondary">Defect triage:</Typography.Text>
            <DefectTag defect={run.defect_type} />
            <Select size="small" style={{ width: 180 }} placeholder="set defect type" value={run.defect_type}
              onChange={(d) => triage.mutate(d)} options={DEFECTS.map((d) => ({ value: d, label: d.replace(/_/g, " ") }))} />
            {run.failure_signature && <Typography.Text code style={{ fontSize: 11 }}>sig {run.failure_signature.slice(0, 12)}</Typography.Text>}
          </Space>
        )}
      </Card>

      <Tabs items={[
        {
          key: "assertions", label: `Assertions (${run.assertions.length})`,
          children: (
            <Table rowKey={(_, i) => String(i)} size="small" pagination={false} dataSource={run.assertions}
              columns={[
                { title: "Source", dataIndex: "source" },
                { title: "Target", dataIndex: "target", render: (v) => v || "—" },
                { title: "Operator", dataIndex: "operator" },
                { title: "Expected", dataIndex: "expected", render: (v) => <Typography.Text code>{JSON.stringify(v)}</Typography.Text> },
                { title: "Actual", dataIndex: "actual", render: (v) => <Typography.Text code>{JSON.stringify(v)}</Typography.Text> },
                { title: "", dataIndex: "passed", render: (p) => <Tag color={p ? "success" : "error"}>{p ? "✓" : "✗"}</Tag> },
              ]} />
          ),
        },
        {
          key: "response", label: "Response",
          children: (
            <Row gutter={16}>
              <Col span={16}><pre className="qtp-code" style={{ maxHeight: 400 }}>{resp.body_text || "(no body captured)"}</pre></Col>
              <Col span={8}>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="Status">{resp.status_code ?? "—"}</Descriptions.Item>
                  <Descriptions.Item label="Time">{resp.elapsed_ms ?? "—"} ms</Descriptions.Item>
                  <Descriptions.Item label="URL">{resp.url || "—"}</Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          ),
        },
        {
          key: "steps", label: `Steps (${run.steps.length})`,
          children: <Table rowKey="name" size="small" pagination={false} dataSource={run.steps}
            columns={[{ title: "Step", dataIndex: "name" }, { title: "Status", dataIndex: "status", render: (s) => <StatusTag status={s} /> },
            { title: "Duration", dataIndex: "duration_ms", render: (m) => <Duration ms={m} /> }, { title: "Error", dataIndex: "error" }]} />,
        },
        {
          key: "logs", label: `Logs (${logs.length})`,
          children: <pre className="qtp-code" style={{ maxHeight: 400 }}>{logs.map((l: any) => `[${l.level}] ${l.message}`).join("\n") || "(no logs)"}</pre>,
        },
      ]} />
    </div>
  );
}
