import { useState } from "react";
import { Card, Descriptions, Button, Typography, Table, Space, Tabs, App, Tag, Row, Col, Alert, Modal, Select, Form, Input, List } from "antd";
import { PlayCircleOutlined, ArrowLeftOutlined, ApiOutlined, EditOutlined } from "@ant-design/icons";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qtp } from "../api/qtp";
import { StatusTag, TypeTag } from "../components/tags";
import ExecutionFlow from "../components/ExecutionFlow";
import ReactECharts from "echarts-for-react";
import CodeSnippet from "../components/CodeSnippet";

const METHOD_COLOR: Record<string, string> = {
  GET: "green", POST: "blue", PUT: "orange", PATCH: "gold", DELETE: "red", HEAD: "default",
};

export default function TestDetailPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [commentForm] = Form.useForm();
  const [searchParams] = useSearchParams();
  const runId = searchParams.get("runId");

  const { data: runData } = useQuery({ 
    queryKey: ["run", runId], 
    queryFn: () => qtp.run(runId!),
    enabled: !!runId
  });

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

  const getFlowSteps = () => {
    if (!t?.steps?.length) return [];
    // If we have an active runId, try to overlay status onto the definition steps.
    const runSteps = runData?.steps || [];
    return t.steps.map((step: any) => {
      const rs = runSteps.find((r: any) => r.name === step.name || r.step_id === step.id);
      return {
        ...step,
        status: rs ? rs.status : (runData && runData.status !== "running" ? undefined : "queued"),
        duration_ms: rs?.duration_ms
      };
    });
  };
  const flowSteps = getFlowSteps();

  const statusCounts = runs.reduce((acc: any, r: any) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const triggerCounts = runs.reduce((acc: any, r: any) => {
    const trigger = r.trigger || "unknown";
    acc[trigger] = (acc[trigger] || 0) + 1;
    return acc;
  }, {});

  const pieOptionStatus = {
    tooltip: { trigger: "item" },
    legend: { bottom: 0 },
    series: [{
      type: "pie", radius: ["45%", "70%"], center: ["50%", "45%"],
      data: Object.entries(statusCounts).map(([k, v]) => ({ 
        name: k, 
        value: v as number, 
        itemStyle: { color: k === 'passed' ? '#52c41a' : k === 'failed' ? '#ff4d4f' : k === 'error' ? '#fa541c' : '#faad14' } 
      })),
    }],
  };

  const pieOptionTrigger = {
    tooltip: { trigger: "item" },
    legend: { bottom: 0 },
    series: [{
      type: "pie", radius: ["45%", "70%"], center: ["50%", "45%"],
      data: Object.entries(triggerCounts).map(([k, v]) => ({ name: k, value: v as number })),
    }],
  };

  const chartData = runs.slice().reverse();
  const runChartOptions = {
    tooltip: { trigger: 'axis', formatter: (params: any) => { const p = params[0]; const data = chartData[p.dataIndex]; return `${data.queued_at?.replace("T", " ").slice(0, 19)}<br/>Status: ${data.status}<br/>Duration: ${data.duration_ms || 0} ms`; } },
    xAxis: { type: 'category', data: chartData.map((r: any) => ""), show: false },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } } },
    series: [{
      data: chartData.map((r: any) => ({ value: r.duration_ms || 0, itemStyle: { color: r.status === 'passed' ? '#52c41a' : (r.status === 'error' || r.status === 'failed' ? '#ff4d4f' : '#faad14') } })),
      type: 'bar', barMaxWidth: 20, itemStyle: { borderRadius: [2, 2, 0, 0] }
    }],
    grid: { left: 40, right: 10, top: 10, bottom: 0 },
  };

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav("/scenarios")}>Scenarios</Button>
        <Button type="primary" icon={<PlayCircleOutlined />} loading={run.isPending} onClick={() => run.mutate()}>Run now</Button>
      </Space>
      <Typography.Title level={3}>
        {t.name} <TypeTag type={t.type} />
      </Typography.Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Key"><Typography.Text code>{t.key}</Typography.Text></Descriptions.Item>
          <Descriptions.Item label="Source">{t.source === "code" ? "Python (framework)" : "UI request builder"}</Descriptions.Item>
          <Descriptions.Item label="Last result"><StatusTag status={t.last_run_status} /></Descriptions.Item>
          
          <Descriptions.Item label="Target">{t.target ? <><Tag color="geekblue">{t.target.key}</Tag> {t.target.name}</> : "—"}</Descriptions.Item>
          <Descriptions.Item label="Base URL">{t.target ? <Typography.Text code>{t.target.base_url}</Typography.Text> : "—"}</Descriptions.Item>
          <Descriptions.Item label="Owner">{t.owner || "—"}</Descriptions.Item>

          <Descriptions.Item label="Calls">
            {t.method && <Tag>{t.method}</Tag>}
            <Typography.Text code>{effectiveUrl || t.url_template || "—"}</Typography.Text>
          </Descriptions.Item>
          {t.code_ref && <Descriptions.Item label="Code ref"><Typography.Text code>{t.code_ref}</Typography.Text></Descriptions.Item>}
          
          <Descriptions.Item label="Tags" span={3}>
            <Space wrap>
              {(t.tags || []).map((x: string) => <Tag key={x}>{x}</Tag>)}
              <Button size="small" type="dashed" icon={<EditOutlined />} onClick={() => { setEditingTags(t.tags || []); setIsEditingTags(true); }}>Edit</Button>
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {runs.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <Card size="small" title="Status Distribution" bordered={false} style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <ReactECharts option={pieOptionStatus} style={{ height: 200 }} />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" title="Trigger Distribution" bordered={false} style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <ReactECharts option={pieOptionTrigger} style={{ height: 200 }} />
            </Card>
          </Col>
        </Row>
      )}

      <Tabs items={[
        ...(flowSteps.length > 0 ? [{
          key: "flow", label: "Execution Plan (Flow)",
          children: (
            <div style={{ marginTop: 12 }}>
              <ExecutionFlow steps={flowSteps} status={runData?.status || "queued"} />
            </div>
          )
        }] : []),
        {
          key: "code", label: t.source === "code" ? "Code" : "Request definition",
          children: t.source_code ? (
            <div>
              <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
                Reflected source of <Typography.Text code>{t.code_ref}</Typography.Text> — this is exactly what runs.
              </Typography.Paragraph>
              <CodeSnippet language="python" code={t.source_code} maxHeight={520} />
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
                            <CodeSnippet language="json" code={s.body.raw} />
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
              <CodeSnippet language="json" code={JSON.stringify(t.config, null, 2)} maxHeight={520} />
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
            <div>
              {runs.length > 0 && (
                <div style={{ marginBottom: 16, padding: '16px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Execution Duration History</Typography.Text>
                  <ReactECharts option={runChartOptions} style={{ height: 120, width: '100%' }} />
                </div>
              )}
              <Table rowKey="id" size="small" dataSource={runs}
              onRow={(r) => ({ onClick: () => nav(`/runs/${r.id}`), style: { cursor: "pointer" } })}
              columns={[
                { title: "Status", dataIndex: "status", render: (s) => <StatusTag status={s} /> },
                { title: "Trigger", dataIndex: "trigger" },
                { title: "Duration", dataIndex: "duration_ms", render: (m) => m != null ? `${m} ms` : "—" },
                { title: "Queued", dataIndex: "queued_at", render: (v) => v?.replace("T", " ").slice(0, 19) },
              ]} />
            </div>
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
                expandedRowRender: (r) => <CodeSnippet language="json" code={JSON.stringify(r.config, null, 2)} />,
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
