import { useState } from "react";
import { Card, Descriptions, Button, Typography, Table, Space, Tabs, App, Tag, Row, Col, Alert, Modal, Select, Form, Input, List } from "antd";
import { PlayCircleOutlined, ArrowLeftOutlined, ApiOutlined, EditOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qtp } from "../api/qtp";
import { StatusTag, TypeTag } from "../components/tags";

const METHOD_COLOR: Record<string, string> = {
  GET: "green", POST: "blue", PUT: "orange", PATCH: "gold", DELETE: "red", HEAD: "default",
};

export default function TestDetailPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [commentForm] = Form.useForm();

  const [isEditingTags, setIsEditingTags] = useState(false);
  const [editingTags, setEditingTags] = useState<string[]>([]);

  const { data: t } = useQuery({ queryKey: ["test", id], queryFn: () => qtp.test(id) });
  const { data: runs = [] } = useQuery({ queryKey: ["runs", "byTest", id], queryFn: () => qtp.runs(`?test_definition_id=${id}`) });
  const { data: allTags = [] } = useQuery({ queryKey: ["allTags"], queryFn: () => qtp.tags("") });
  const { data: comments = [] } = useQuery({ queryKey: ["testComments", id], queryFn: () => qtp.testComments(id) });

  const run = useMutation({
    mutationFn: () => qtp.runTest(id),
    onSuccess: (r) => { message.success("Run queued"); nav(`/runs/${r.id}`); },
    onError: (e: any) => message.error(e.message || "failed"),
  });

  const updateTags = useMutation({
    mutationFn: (newTags: string[]) => qtp.updateTestTags(id, newTags),
    onSuccess: () => {
      message.success("Tags updated");
      qc.invalidateQueries({ queryKey: ["test", id] });
      setIsEditingTags(false);
    },
    onError: (e: any) => message.error(e.message || "failed to update tags"),
  });

  const addComment = useMutation({
    mutationFn: (v: { body: string; tags: string[] }) => qtp.createTestComment(id, v.body, v.tags),
    onSuccess: () => {
      message.success("Comment added");
      qc.invalidateQueries({ queryKey: ["testComments", id] });
      commentForm.resetFields();
    },
    onError: (e: any) => message.error(e.message || "failed to add comment"),
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
              <Descriptions.Item label="Tags">
                <Space wrap>
                  {(t.tags || []).map((x) => <Tag key={x}>{x}</Tag>)}
                  <Button size="small" type="dashed" icon={<EditOutlined />} onClick={() => { setEditingTags(t.tags || []); setIsEditingTags(true); }}>Edit</Button>
                </Space>
              </Descriptions.Item>
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
            t.steps && t.steps.length > 0 ? (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={t.steps}
                columns={[
                  { title: "Step ID", dataIndex: "id" },
                  { title: "Name", dataIndex: "name" },
                  { title: "Method", dataIndex: "method", render: (m) => <Tag color={METHOD_COLOR[m] || "default"}>{m}</Tag> },
                  { title: "Target", dataIndex: "target", render: (tgt) => tgt ? <Tag color="geekblue">{tgt}</Tag> : "—" },
                  { title: "URL", dataIndex: "url" },
                  { title: "Assertions", render: (_, s: any) => (s.assertions || []).length },
                  { title: "Captures", render: (_, s: any) => (s.captures || []).length },
                ]}
                expandable={{
                  expandedRowRender: (s: any) => (
                    <div style={{ padding: "8px 16px", background: "#fafafa" }}>
                      <Descriptions size="small" column={1} bordered style={{ marginBottom: 12 }}>
                        {s.headers && s.headers.length > 0 && (
                          <Descriptions.Item label="Headers">
                            {s.headers.map((h: any, idx: number) => (
                              <div key={idx}><Typography.Text code>{h.name}: {h.value}</Typography.Text></div>
                            ))}
                          </Descriptions.Item>
                        )}
                        {s.query && s.query.length > 0 && (
                          <Descriptions.Item label="Query Params">
                            {s.query.map((q: any, idx: number) => (
                              <div key={idx}><Typography.Text code>{q.name}={q.value}</Typography.Text></div>
                            ))}
                          </Descriptions.Item>
                        )}
                        {s.auth && s.auth.type !== "none" && (
                          <Descriptions.Item label="Auth">
                            <Typography.Text code>Type: {s.auth.type}</Typography.Text>
                          </Descriptions.Item>
                        )}
                        {s.body && s.body.mode !== "none" && (
                          <Descriptions.Item label="Body">
                            <pre style={{ margin: 0, fontSize: 11 }}>{s.body.raw}</pre>
                          </Descriptions.Item>
                        )}
                      </Descriptions>
                      
                      {s.assertions && s.assertions.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <Typography.Text strong style={{ display: "block", marginBottom: 4 }}>Assertions:</Typography.Text>
                          <Table rowKey={(_, idx) => String(idx)} size="small" pagination={false} dataSource={s.assertions}
                            columns={[
                              { title: "Source", render: (_, a: any) => a.type || a.source },
                              { title: "Target", render: (_, a: any) => a.path || a.target || "—" },
                              { title: "Operator", dataIndex: "operator" },
                              { title: "Expected", dataIndex: "expected", render: (v) => <Typography.Text code>{JSON.stringify(v)}</Typography.Text> },
                            ]} />
                        </div>
                      )}

                      {s.captures && s.captures.length > 0 && (
                        <div>
                          <Typography.Text strong style={{ display: "block", marginBottom: 4 }}>Captures:</Typography.Text>
                          <Table rowKey={(_, idx) => String(idx)} size="small" pagination={false} dataSource={s.captures}
                            columns={[
                              { title: "Variable Name", dataIndex: "name" },
                              { title: "Source", dataIndex: "source" },
                              { title: "Path", dataIndex: "path", render: (v) => v || "—" },
                            ]} />
                        </div>
                      )}
                    </div>
                  ),
                  rowExpandable: () => true,
                }}
              />
            ) : (
              <pre className="qtp-code" style={{ maxHeight: 520 }}>{JSON.stringify(t.config, null, 2)}</pre>
            )
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

      <Modal title="Edit Test Tags" open={isEditingTags} onCancel={() => setIsEditingTags(false)}
        onOk={() => updateTags.mutate(editingTags)} confirmLoading={updateTags.isPending}>
        <Select
          mode="tags"
          style={{ width: "100%" }}
          placeholder="Select or type tags"
          value={editingTags}
          onChange={setEditingTags}
          options={allTags.map((tag: string) => ({ value: tag, label: tag }))}
        />
      </Modal>
    </div>
  );
}
