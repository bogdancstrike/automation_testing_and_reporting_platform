import { useState } from "react";
import { Card, Descriptions, Button, Typography, Table, Space, Tabs, App, Tag, Select, Row, Col, List, Form, Input } from "antd";
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
  const [commentForm] = Form.useForm();
  
  const [selectedResponseStepIdx, setSelectedResponseStepIdx] = useState<number>(0);

  const active = (s?: string) => ["queued", "claimed", "running"].includes(s || "");
  const { data: run } = useQuery({
    queryKey: ["run", id], queryFn: () => qtp.run(id),
    refetchInterval: (q) => (active((q.state.data as any)?.status) ? 2000 : false),
  });
  const { data: logs = [] } = useQuery({ queryKey: ["runlogs", id, run?.status], queryFn: () => qtp.runLogs(id) });
  const { data: comments = [] } = useQuery({ queryKey: ["runComments", id], queryFn: () => qtp.runComments(id) });
  const { data: allTags = [] } = useQuery({ queryKey: ["allTags"], queryFn: () => qtp.tags("") });

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

  const addComment = useMutation({
    mutationFn: (v: { body: string; tags: string[] }) => qtp.createRunComment(id, v.body, v.tags),
    onSuccess: () => {
      message.success("Comment added");
      qc.invalidateQueries({ queryKey: ["runComments", id] });
      commentForm.resetFields();
    },
    onError: (e: any) => message.error(e.message || "failed to add comment"),
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
          children: (() => {
            const hasSteps = Array.isArray(resp.steps) && resp.steps.length > 0;
            if (hasSteps) {
              const step = resp.steps[selectedResponseStepIdx] || resp.steps[0] || {};
              const sResp = step.response || {};
              return (
                <Row gutter={16}>
                  <Col span={6} style={{ borderRight: "1px solid #f0f0f0" }}>
                    <List
                      size="small"
                      dataSource={resp.steps}
                      renderItem={(s: any, idx) => (
                        <List.Item
                          onClick={() => setSelectedResponseStepIdx(idx)}
                          style={{
                            cursor: "pointer",
                            background: selectedResponseStepIdx === idx ? "#e6f4ff" : undefined,
                            paddingInline: 8,
                            borderRadius: 4,
                            marginBottom: 4,
                          }}
                        >
                          <Space style={{ width: "100%", justifyContent: "space-between" }}>
                            <Typography.Text ellipsis style={{ maxWidth: 100 }}>{s.name}</Typography.Text>
                            <Tag color={s.status === "passed" ? "success" : "error"}>{s.status === "passed" ? "✓" : "✗"}</Tag>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </Col>
                  <Col span={18}>
                    <div style={{ marginBottom: 12 }}>
                      <Typography.Title level={5} style={{ margin: 0 }}>
                        {step.name} <Tag>{step.method}</Tag>
                      </Typography.Title>
                      <Typography.Text code style={{ fontSize: 11 }}>{step.url}</Typography.Text>
                    </div>
                    <Row gutter={16}>
                      <Col span={16}>
                        <pre className="qtp-code" style={{ maxHeight: 320 }}>{sResp.body_text || "(no body captured)"}</pre>
                      </Col>
                      <Col span={8}>
                        <Descriptions column={1} size="small" bordered>
                          <Descriptions.Item label="Status">{sResp.status_code ?? "—"}</Descriptions.Item>
                          <Descriptions.Item label="Time">{sResp.elapsed_ms ?? "—"} ms</Descriptions.Item>
                          <Descriptions.Item label="URL">{sResp.url || "—"}</Descriptions.Item>
                        </Descriptions>
                        {step.captures && step.captures.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <Typography.Text type="secondary">Captured Variables</Typography.Text>
                            <List size="small" dataSource={step.captures} renderItem={(capName: any) => (
                              <List.Item style={{ padding: "4px 8px" }}>
                                <Space>
                                  <Typography.Text code>{capName}</Typography.Text>
                                  <Typography.Text type="secondary">extracted</Typography.Text>
                                </Space>
                              </List.Item>
                            )} />
                          </div>
                        )}
                      </Col>
                    </Row>
                  </Col>
                </Row>
              );
            }
            return (
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
            );
          })(),
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
        {
          key: "comments", label: `Comments (${comments.length})`,
          children: (
            <div style={{ padding: "8px 0" }}>
              <List
                dataSource={comments}
                locale={{ emptyText: "No comments yet" }}
                renderItem={(item: any) => (
                  <List.Item style={{ padding: "12px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Typography.Text strong>{item.author}</Typography.Text>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {item.created_at?.replace("T", " ").slice(0, 19)}
                          </Typography.Text>
                          {(item.tags || []).map((tc: string) => (
                            <Tag key={tc} color="purple">{tc}</Tag>
                          ))}
                        </Space>
                      }
                      description={<div style={{ whiteSpace: "pre-wrap", color: "#333", marginTop: 4 }}>{item.body}</div>}
                    />
                  </List.Item>
                )}
              />
              <Card size="small" title="Add a comment" style={{ marginTop: 16 }}>
                <Form form={commentForm} layout="vertical" onFinish={(v) => addComment.mutate(v)}>
                  <Form.Item name="body" rules={[{ required: true, message: "Comment body is required" }]} style={{ marginBottom: 12 }}>
                    <Input.TextArea rows={3} placeholder="Write a comment..." />
                  </Form.Item>
                  <Form.Item name="tags" label="Comment Tags" style={{ marginBottom: 12 }}>
                    <Select mode="tags" style={{ width: "100%" }} placeholder="Add tags to this comment" options={allTags.map((tag: string) => ({ value: tag, label: tag }))} />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={addComment.isPending}>Add comment</Button>
                </Form>
              </Card>
            </div>
          ),
        },
      ]} />
    </div>
  );
}
