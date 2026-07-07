import { Card, Descriptions, Button, Typography, Table, Space, Tabs, App, Tag } from "antd";
import { PlayCircleOutlined, ArrowLeftOutlined } from "@ant-design/icons";
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

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav("/tests")}>Catalog</Button>
        <Button type="primary" icon={<PlayCircleOutlined />} loading={run.isPending} onClick={() => run.mutate()}>Run now</Button>
      </Space>
      <Typography.Title level={3}>{t.name} <TypeTag type={t.type} /></Typography.Title>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Key"><Typography.Text code>{t.key}</Typography.Text></Descriptions.Item>
          <Descriptions.Item label="Source">{t.source}</Descriptions.Item>
          <Descriptions.Item label="Target">{t.target_key}</Descriptions.Item>
          <Descriptions.Item label="Owner">{t.owner || "—"}</Descriptions.Item>
          <Descriptions.Item label="Status"><Tag>{t.status}</Tag></Descriptions.Item>
          <Descriptions.Item label="Last result"><StatusTag status={t.last_run_status} /></Descriptions.Item>
          <Descriptions.Item label="Tags">{(t.tags || []).map((x) => <Tag key={x}>{x}</Tag>)}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Tabs items={[
        {
          key: "runs", label: "Recent runs",
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
