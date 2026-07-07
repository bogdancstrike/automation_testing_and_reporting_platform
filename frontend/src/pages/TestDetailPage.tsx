import { Card, Descriptions, Button, Typography, Table, Space, Tabs, App, Tag, Row, Col, Alert } from "antd";
import { PlayCircleOutlined, ArrowLeftOutlined, ApiOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { qtp } from "../api/qtp";
import { StatusTag, TypeTag } from "../components/tags";

export default function TestDetailPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { message } = App.useApp();
  const { data: t } = useQuery({ queryKey: ["test", id], queryFn: () => qtp.test(id) });
  const { data: runs = [] } = useQuery({ queryKey: ["runs", "byTest", id], queryFn: () => qtp.runs(`?test_definition_id=${id}`) });

  const run = useMutation({
    mutationFn: () => qtp.runTest(id),
    onSuccess: (r) => { message.success("Run queued"); nav(`/runs/${r.id}`); },
    onError: (e: any) => message.error(e.message || "failed"),
  });

  if (!t) return null;
  const base = t.target?.base_url || "";
  const effectiveUrl = (t.url_template || "").replace("{{base_url}}", base);

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav("/tests")}>Catalog</Button>
        <Button type="primary" icon={<PlayCircleOutlined />} loading={run.isPending} onClick={() => run.mutate()}>Run now</Button>
      </Space>
      <Typography.Title level={3} style={{ marginBottom: 4 }}>{t.name} <TypeTag type={t.type} /></Typography.Title>
      <Typography.Text type="secondary" code>{t.key}</Typography.Text>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card size="small" title="Definition">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Source">{t.source === "code" ? "Python (framework)" : "UI request builder"}</Descriptions.Item>
              <Descriptions.Item label="Owner">{t.owner || "—"}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag>{t.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="Last result"><StatusTag status={t.last_run_status} /></Descriptions.Item>
              <Descriptions.Item label="Tags">{(t.tags || []).map((x) => <Tag key={x}>{x}</Tag>) || "—"}</Descriptions.Item>
              {t.code_ref && <Descriptions.Item label="Code ref"><Typography.Text code>{t.code_ref}</Typography.Text></Descriptions.Item>}
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title={<Space><ApiOutlined /> Target application under test</Space>}>
            {t.target ? (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Target"><Tag color="geekblue">{t.target.key}</Tag> {t.target.name}</Descriptions.Item>
                <Descriptions.Item label="Base URL"><Typography.Text code>{t.target.base_url}</Typography.Text></Descriptions.Item>
                <Descriptions.Item label="Calls">
                  {t.method && <Tag>{t.method}</Tag>}
                  <Typography.Text code>{effectiveUrl || t.url_template || "—"}</Typography.Text>
                </Descriptions.Item>
              </Descriptions>
            ) : <Alert type="warning" showIcon message={`Target '${t.target_key}' not found — the URL cannot be resolved.`} />}
          </Card>
        </Col>
      </Row>

      <Tabs style={{ marginTop: 16 }} items={[
        {
          key: "code", label: t.source === "code" ? "Code" : "Request definition",
          children: t.source_code ? (
            <div>
              <Typography.Paragraph type="secondary">
                Reflected source of <Typography.Text code>{t.code_ref}</Typography.Text> — this is exactly what runs.
              </Typography.Paragraph>
              <pre className="qtp-code" style={{ maxHeight: 520 }}>{t.source_code}</pre>
            </div>
          ) : (
            <pre className="qtp-code" style={{ maxHeight: 520 }}>{JSON.stringify(t.config, null, 2)}</pre>
          ),
        },
        {
          key: "assertions", label: `Assertions (${(t.assertions || []).length})`,
          children: (
            <Table rowKey={(_, i) => String(i)} size="small" pagination={false} dataSource={t.assertions || []}
              columns={[
                { title: "Source", render: (_, a: any) => a.type || a.source },
                { title: "Target", render: (_, a: any) => a.path || a.target || "—" },
                { title: "Operator", dataIndex: "operator" },
                { title: "Expected", dataIndex: "expected", render: (v) => <Typography.Text code>{JSON.stringify(v)}</Typography.Text> },
              ]}
              locale={{ emptyText: "No assertions" }} />
          ),
        },
        {
          key: "runs", label: `Recent runs (${runs.length})`,
          children: (
            <Table rowKey="id" size="small" dataSource={runs}
              onRow={(r) => ({ onClick: () => nav(`/runs/${r.id}`), style: { cursor: "pointer" } })}
              columns={[
                { title: "Status", dataIndex: "status", render: (s) => <StatusTag status={s} /> },
                { title: "Trigger", dataIndex: "trigger" },
                { title: "Duration", dataIndex: "duration_ms", render: (m) => m != null ? `${m} ms` : "—" },
                { title: "Queued", dataIndex: "queued_at", render: (v) => v?.replace("T", " ").slice(0, 19) },
              ]} />
          ),
        },
        {
          key: "revisions", label: `Revisions (${t.revisions.length})`,
          children: (
            <Table rowKey="id" size="small" dataSource={t.revisions}
              columns={[
                { title: "#", dataIndex: "revision_number", width: 60 },
                { title: "Code ref", dataIndex: "code_ref", render: (v) => v ? <Typography.Text code>{v}</Typography.Text> : "—" },
                { title: "Created", dataIndex: "created_at", render: (v) => v?.replace("T", " ").slice(0, 19) },
              ]}
              expandable={{
                expandedRowRender: (r) => <pre className="qtp-code">{JSON.stringify(r.config, null, 2)}</pre>,
                rowExpandable: (r) => Object.keys(r.config || {}).length > 0,
              }} />
          ),
        },
      ]} />
    </div>
  );
}
