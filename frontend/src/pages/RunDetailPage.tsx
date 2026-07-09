import { useState } from "react";
import { Card, Descriptions, Button, Typography, Table, Space, Tabs, App, Tag, Select, Row, Col, List, Form, Input } from "antd";
import { ArrowLeftOutlined, ExperimentOutlined, StopOutlined, PlayCircleOutlined, WarningOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qtp } from "../api/qtp";
import { StatusTag, DefectTag, Duration } from "../components/tags";
import ExecutionFlow from "../components/ExecutionFlow";
import WaterfallChart from "../components/WaterfallChart";
import CodeSnippet from "../components/CodeSnippet";
import StepTree from "../components/StepTree";
import { formatLocalTime } from "../components/tags";
import { AuditTable } from "../components/AuditTable";
import { config } from "../config";

const DEFECTS = ["product_bug", "automation_bug", "system_issue", "to_investigate", "no_defect"];
const ACTIVE_RUN_REFETCH_MS = 1000;

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
    refetchInterval: (q) => (active((q.state.data as any)?.status) ? ACTIVE_RUN_REFETCH_MS : false),
  });
  
  const { data: testDefinition } = useQuery({
    queryKey: ["test", run?.scenario_id],
    queryFn: () => qtp.test(run!.scenario_id),
    enabled: !!run?.scenario_id
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
  const rerun = useMutation({
    mutationFn: () => qtp.restartRun(id),
    onSuccess: () => { message.success("Run restarted"); qc.invalidateQueries({ queryKey: ["run", id] }); },
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
  
  let errorMessage = run.error_message || "";
  let aiAnalysis: any = null;
  if (errorMessage.includes("[AI Root Cause Analysis]")) {
    const parts = errorMessage.split("[AI Root Cause Analysis]");
    errorMessage = parts[0].trim();
    try {
      aiAnalysis = JSON.parse(parts[1].trim());
    } catch(e) {
      aiAnalysis = { summary: parts[1].trim(), technical_details: "", suggested_fix: "" };
    }
  }
  
  const runRevision = testDefinition?.revisions?.find((r: any) => r.id === run.revision_id) || testDefinition?.revisions?.[testDefinition?.revisions?.length - 1] || testDefinition;
  const sourceCode = runRevision?.source_code || testDefinition?.source_code;

  // Per-step "View Distributed Trace" button — shown on 5xx responses. Prefers
  // the traceparent captured on the request, falling back to the run-level trace
  // id (the whole run is a single distributed trace).
  const renderJaegerButton = (r: any) => {
    if (r?.status_code >= 500) {
      const headers = r?.timings?.payload?.request_headers || {};
      const traceparent = headers['traceparent'] || headers['Traceparent'];
      const traceId = (traceparent && traceparent.split('-')[1]) || run.trace_id;
      if (traceId) {
        return (
          <Button
            type="primary"
            danger
            icon={<ExperimentOutlined />}
            href={`${config.jaegerUrl}/trace/${traceId}`}
            target="_blank"
            style={{ marginTop: 12, width: "100%" }}
          >
            View Distributed Trace
          </Button>
        );
      }
    }
    return null;
  };

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav("/runs")}>Runs</Button>
        <Button icon={<ExperimentOutlined />} onClick={() => nav(`/scenarios/${run.scenario_id}`)}>Open scenario</Button>
        {active(run.status) && <Button danger icon={<StopOutlined />} loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel</Button>}
        {run.status !== "passed" && !active(run.status) && <Button type="primary" icon={<PlayCircleOutlined />} loading={rerun.isPending} onClick={() => rerun.mutate()}>Re-run</Button>}
      </Space>
      <Typography.Title level={3}>
        {run.test_name || "Run"} <StatusTag status={run.status} />
      </Typography.Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="Trigger">{run.trigger}</Descriptions.Item>
          <Descriptions.Item label="Target">{run.target_key || "—"}</Descriptions.Item>
          <Descriptions.Item label="Worker">{run.worker_name || "—"}</Descriptions.Item>
          <Descriptions.Item label="Duration"><Duration ms={run.duration_ms} /></Descriptions.Item>
          <Descriptions.Item label="Environment">{run.environment}</Descriptions.Item>
          <Descriptions.Item label="Queued">{formatLocalTime(run.queued_at)}</Descriptions.Item>
          {failed && <Descriptions.Item label="Failure">{run.error_category}: {errorMessage}</Descriptions.Item>}
        </Descriptions>
        {run.trace_id && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              borderRadius: 6,
              border: `1px solid ${failed ? "#ffccc7" : "var(--qtp-surface-border)"}`,
              background: failed ? "#fff2f0" : "rgba(37, 99, 235, 0.06)",
            }}
          >
            <Space align="center" wrap>
              <ExperimentOutlined style={{ color: failed ? "#cf1322" : "#1677ff" }} />
              <Typography.Text strong>Distributed Trace</Typography.Text>
              <Typography.Text code copyable={{ text: run.trace_id }} style={{ fontSize: 12 }}>
                {run.trace_id}
              </Typography.Text>
              <Button
                size="small"
                type={failed ? "primary" : "default"}
                danger={failed}
                icon={<ExperimentOutlined />}
                href={`${config.jaegerUrl}/trace/${run.trace_id}`}
                target="_blank"
              >
                View Distributed Trace
              </Button>
            </Space>
          </div>
        )}
        {aiAnalysis && (
          <div style={{ marginTop: 16 }}>
            <Card 
              size="small" 
              title={<><ExperimentOutlined style={{ color: '#1677ff' }} /> <span style={{ color: '#1677ff' }}>AI Root Cause Analysis</span></>}
              style={{ borderColor: '#91caff', background: '#f0f5ff', borderRadius: 6 }}
              headStyle={{ borderBottom: '1px solid #91caff', background: '#e6f4ff', borderRadius: '6px 6px 0 0' }}
            >
              <Typography.Text strong style={{ fontSize: 14 }}>{aiAnalysis.summary}</Typography.Text>
              
              {aiAnalysis.technical_details && (
                <div style={{ marginTop: 12 }}>
                  <Typography.Text type="secondary" strong style={{ fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Technical Details</Typography.Text>
                  <div style={{ marginTop: 2, color: '#333' }}>
                    {aiAnalysis.technical_details}
                  </div>
                </div>
              )}
              
              {aiAnalysis.suggested_fix && (
                <div style={{ marginTop: 12 }}>
                  <Typography.Text type="secondary" strong style={{ fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Suggested Fix</Typography.Text>
                  <div style={{ marginTop: 4 }}>
                    <Tag color="blue" style={{ whiteSpace: 'normal', height: 'auto', padding: '4px 8px' }}>
                      {aiAnalysis.suggested_fix}
                    </Tag>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
        {run.cleanup_failed && (
          <div style={{ marginTop: 12 }}>
            <Typography.Text type="danger" strong><WarningOutlined /> Cleanup Failed:</Typography.Text>
            <div style={{ background: "#fff2f0", border: "1px solid #ffccc7", padding: "8px 12px", marginTop: 4, borderRadius: 4, whiteSpace: "pre-wrap", color: "#cf1322", fontSize: 12 }}>
              {run.cleanup_error || "Unknown error"}
            </div>
          </div>
        )}
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
        ...(sourceCode ? [{
          key: "code", 
          label: "Code",
          children: (
            <CodeSnippet language={testDefinition?.source === "ui" ? "json" : "python"} code={sourceCode} maxHeight={600} />
          )
        }] : []),
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
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={6} style={{ borderRight: "1px solid var(--qtp-surface-border)" }}>
                    <List
                      size="small"
                      dataSource={resp.steps}
                      renderItem={(s: any, idx) => (
                        <List.Item
                          onClick={() => setSelectedResponseStepIdx(idx)}
                          style={{
                            cursor: "pointer",
                            background: selectedResponseStepIdx === idx ? "rgba(37, 99, 235, 0.15)" : undefined,
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
                  <Col xs={24} md={18}>
                    <div style={{ marginBottom: 12 }}>
                      <Typography.Title level={5} style={{ margin: 0 }}>
                        {step.name} <Tag>{step.method}</Tag>
                      </Typography.Title>
                      <Typography.Text code style={{ fontSize: 11 }}>{step.url}</Typography.Text>
                    </div>
                    <Row gutter={[16, 16]}>
                      <Col xs={24} lg={16}>
                        <CodeSnippet language="json" code={sResp.body_text || "(no body captured)"} maxHeight={320} />
                      </Col>
                      <Col xs={24} lg={8}>
                        <Descriptions column={1} size="small" bordered>
                          <Descriptions.Item label="Status">{sResp.status_code ?? "—"}</Descriptions.Item>
                          <Descriptions.Item label="Time">{sResp.elapsed_ms ?? "—"} ms</Descriptions.Item>
                          <Descriptions.Item label="URL">{sResp.url || "—"}</Descriptions.Item>
                        </Descriptions>
                        {renderJaegerButton(sResp)}
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
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}><CodeSnippet language="json" code={resp.body_text || "(no body captured)"} maxHeight={400} /></Col>
                <Col xs={24} lg={8}>
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="Status">{resp.status_code ?? "—"}</Descriptions.Item>
                    <Descriptions.Item label="Time">{resp.elapsed_ms ?? "—"} ms</Descriptions.Item>
                    <Descriptions.Item label="URL">{resp.url || "—"}</Descriptions.Item>
                  </Descriptions>
                  {renderJaegerButton(resp)}
                </Col>
              </Row>
            );
          })(),
        },
        {
          key: "logs", label: `Logs (${logs.length})`,
          children: <CodeSnippet language="plaintext" code={logs.map((l: any) => `[${l.level}] ${l.message}`).join("\n") || "(no logs)"} maxHeight={400} />,
        },
        {
          key: "waterfall", label: "Waterfall",
          children: (
            <div style={{ marginTop: 12 }}>
              <WaterfallChart steps={run.steps} />
            </div>
          ),
        },
        {
          key: "flow", label: "Steps Flow",
          children: (
            <div style={{ marginTop: 12 }}>
              <ExecutionFlow steps={run.steps} status={run.status} />
            </div>
          ),
        },
        {
          key: "steps", label: `Step Tree (${run.steps.length})`,
          children: (
            <div style={{ marginTop: 12 }}>
              <StepTree steps={run.steps} logs={logs} />
            </div>
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
                  <List.Item style={{ padding: "12px 0", borderBottom: "1px solid var(--qtp-surface-border)" }}>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Typography.Text strong>{item.author}</Typography.Text>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {formatLocalTime(item.created_at)}
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
        {
          key: "audit", label: `Audit`,
          children: (
            <AuditTable baseFilters={{ related_to: id }} />
          ),
        },
      ]} />
    </div>
  );
}
