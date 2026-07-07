import { useState } from "react";
import {
  Row, Col, Card, Select, Input, Button, Tabs, Table, Space, Typography,
  Tag, App, Modal, Form, Alert, Segmented, List, Popconfirm, InputNumber, Empty, Tooltip,
} from "antd";
import {
  SendOutlined, PlusOutlined, DeleteOutlined, SaveOutlined, ClockCircleOutlined,
  FileAddOutlined, ArrowUpOutlined, ArrowDownOutlined, CopyOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qtp } from "../api/qtp";
import type { SendResult } from "../api/types";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];
const SOURCES = ["status_code", "json_path", "header", "body_text", "response_time_ms"];
const OPERATORS = ["equals", "not_equals", "contains", "not_contains", "matches", "exists",
  "not_exists", "gt", "gte", "lt", "lte", "length_gte", "length_lte"];
const METHOD_COLOR: Record<string, string> = {
  GET: "green", POST: "blue", PUT: "orange", PATCH: "gold", DELETE: "red", HEAD: "default",
};

type KV = { name: string; value: string; enabled: boolean };
type Assn = { type: string; path?: string; operator: string; expected?: string };
type Capture = { name: string; source: string; path?: string; optional?: boolean };

interface RequestStep {
  id: string;
  name: string;
  method: string;
  url: string;
  target?: string;
  headers: KV[];
  query: KV[];
  auth?: {
    type: string;
    tokenSecretRef?: string;
    token?: string;
    headerName?: string;
    value?: string;
    username?: string;
    password?: string;
  };
  bodyMode: "none" | "json" | "text" | "form" | "graphql";
  bodyRaw: string;
  assertions: Assn[];
  captures: Capture[];
}

const createInitialSteps = (): RequestStep[] => [
  {
    id: "request",
    name: "Request",
    method: "GET",
    target: undefined,
    url: "{{base_url}}/get",
    headers: [],
    query: [],
    auth: { type: "none" },
    bodyMode: "none",
    bodyRaw: "",
    assertions: [{ type: "status_code", operator: "equals", expected: "200" }],
    captures: [],
  }
];

export default function RequestBuilderPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { data: targets = [] } = useQuery({ queryKey: ["targets"], queryFn: qtp.targets });
  const { data: saved = [] } = useQuery({ queryKey: ["reqtests"], queryFn: () => qtp.tests("?source=ui") });

  const [mode, setMode] = useState<"single" | "flow">("single");
  const [steps, setSteps] = useState<RequestStep[]>(createInitialSteps());
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [result, setResult] = useState<SendResult | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("Untitled request");
  const [search, setSearch] = useState("");

  const [saveOpen, setSaveOpen] = useState(false);
  const [schedOpen, setSchedOpen] = useState(false);
  const [saveForm] = Form.useForm();
  const [schedForm] = Form.useForm();
  const schedType = Form.useWatch("recurrence_type", schedForm);

  function reset() {
    setSteps(createInitialSteps());
    setCurrentStepIndex(0);
    setMode("single");
    setResult(null);
    setEditingId(null);
    setEditingName("Untitled request");
  }

  async function load(id: string, name: string) {
    const detail = await qtp.test(id);
    const cfg = detail.revisions[detail.revisions.length - 1]?.config || {};
    setEditingId(id);
    setEditingName(name);
    setResult(null);

    let loadedSteps: RequestStep[] = [];
    if (cfg.steps && Array.isArray(cfg.steps) && cfg.steps.length > 0) {
      setMode("flow");
      loadedSteps = cfg.steps.map((s: any) => ({
        id: s.id || `step_${Math.random().toString(36).substr(2, 9)}`,
        name: s.name || "Step",
        method: s.method || "GET",
        target: s.target,
        url: s.url || "",
        headers: (s.headers || []).map((h: any) => ({ name: h.name, value: h.value, enabled: h.enabled !== false })),
        query: (s.query || []).map((q: any) => ({ name: q.name, value: q.value, enabled: q.enabled !== false })),
        auth: s.auth || { type: "none" },
        bodyMode: s.body?.mode || "none",
        bodyRaw: s.body?.raw || "",
        assertions: (s.assertions || []).map((a: any) => ({
          type: a.type || a.source, path: a.path, operator: a.operator,
          expected: a.expected !== undefined ? String(a.expected) : undefined,
        })),
        captures: (s.captures || []).map((c: any) => ({
          name: c.name || "",
          source: c.source || "json_path",
          path: c.path || "",
          optional: c.optional || false
        })),
      }));
    } else {
      setMode("single");
      loadedSteps = [{
        id: "request",
        name: "Request",
        method: cfg.method || "GET",
        target: cfg.target,
        url: cfg.url || "",
        headers: (cfg.headers || []).map((h: any) => ({ name: h.name, value: h.value, enabled: h.enabled !== false })),
        query: (cfg.query || []).map((q: any) => ({ name: q.name, value: q.value, enabled: q.enabled !== false })),
        auth: cfg.auth || { type: "none" },
        bodyMode: cfg.body?.mode || "none",
        bodyRaw: cfg.body?.raw || "",
        assertions: (cfg.assertions || []).map((a: any) => ({
          type: a.type || a.source, path: a.path, operator: a.operator,
          expected: a.expected !== undefined ? String(a.expected) : undefined,
        })),
        captures: (cfg.captures || []).map((c: any) => ({
          name: c.name || "",
          source: c.source || "json_path",
          path: c.path || "",
          optional: c.optional || false
        })),
      }];
    }
    setSteps(loadedSteps);
    setCurrentStepIndex(0);
  }

  function buildConfig() {
    const stepsConfig = steps.map((s) => ({
      id: s.id,
      name: s.name,
      target: s.target,
      method: s.method,
      url: s.url,
      headers: s.headers.filter((h) => h.name),
      query: s.query.filter((q) => q.name),
      auth: s.auth && s.auth.type !== "none" ? s.auth : undefined,
      body: s.bodyMode === "none" ? undefined : { mode: s.bodyMode, raw: s.bodyRaw },
      assertions: s.assertions.map((a) => ({ type: a.type, path: a.path, operator: a.operator, expected: coerce(a.expected) })),
      captures: s.captures.map((c) => ({ name: c.name, source: c.source, path: c.path || undefined, optional: c.optional })),
    }));

    if (mode === "single") {
      const step = stepsConfig[0] || {};
      return {
        target: step.target,
        method: step.method || "GET",
        url: step.url || "",
        headers: step.headers || [],
        query: step.query || [],
        auth: step.auth,
        body: step.body,
        assertions: step.assertions || [],
        captures: step.captures || [],
      };
    } else {
      return {
        target: stepsConfig[0]?.target || undefined,
        steps: stepsConfig,
      };
    }
  }

  const send = useMutation({
    mutationFn: () => qtp.sendRequest(buildConfig()),
    onSuccess: setResult,
    onError: (e: any) => message.error(e.message || "send failed")
  });

  const create = useMutation({
    mutationFn: (name: string) => qtp.createRequestTest({ name, config: buildConfig() }),
    onSuccess: (t) => {
      message.success("Saved");
      setSaveOpen(false);
      setEditingId(t.id);
      setEditingName(t.name);
      qc.invalidateQueries({ queryKey: ["reqtests"] });
    },
    onError: (e: any) => message.error(e.message || "save failed"),
  });

  const update = useMutation({
    mutationFn: () => qtp.updateRequestTest(editingId!, { name: editingName, config: buildConfig() }),
    onSuccess: () => {
      message.success("Updated (new revision)");
      qc.invalidateQueries({ queryKey: ["reqtests"] });
    },
    onError: (e: any) => message.error(e.message || "update failed"),
  });

  const remove = useMutation({
    mutationFn: () => qtp.deleteRequestTest(editingId!),
    onSuccess: () => {
      message.success("Deleted");
      reset();
      qc.invalidateQueries({ queryKey: ["reqtests"] });
    },
    onError: (e: any) => message.error(e.message || "delete failed"),
  });

  const schedule = useMutation({
    mutationFn: (v: any) => qtp.createSchedule({ test_definition_id: editingId!, ...v }),
    onSuccess: () => {
      message.success("Scheduled");
      setSchedOpen(false);
      qc.invalidateQueries({ queryKey: ["schedules"] });
    },
    onError: (e: any) => message.error(e.message || "schedule failed"),
  });

  function addStep() {
    const newStep: RequestStep = {
      id: `step_${Math.random().toString(36).substr(2, 9)}`,
      name: `Step ${steps.length + 1}`,
      method: "GET",
      target: undefined,
      url: "",
      headers: [],
      query: [],
      auth: { type: "none" },
      bodyMode: "none",
      bodyRaw: "",
      assertions: [{ type: "status_code", operator: "equals", expected: "200" }],
      captures: [],
    };
    setSteps([...steps, newStep]);
    setCurrentStepIndex(steps.length);
  }

  function duplicateStep(index: number) {
    const source = steps[index];
    const newStep: RequestStep = {
      ...source,
      id: `step_${Math.random().toString(36).substr(2, 9)}`,
      name: `${source.name} (Copy)`,
      headers: source.headers.map(h => ({ ...h })),
      query: (source.query || []).map(q => ({ ...q })),
      auth: source.auth ? { ...source.auth } : { type: "none" },
      assertions: source.assertions.map(a => ({ ...a })),
      captures: (source.captures || []).map(c => ({ ...c })),
    };
    const newSteps = [...steps];
    newSteps.splice(index + 1, 0, newStep);
    setSteps(newSteps);
    setCurrentStepIndex(index + 1);
  }

  function deleteStep(index: number) {
    if (steps.length <= 1) return;
    const newSteps = steps.filter((_, idx) => idx !== index);
    setSteps(newSteps);
    if (currentStepIndex >= newSteps.length) {
      setCurrentStepIndex(newSteps.length - 1);
    }
  }

  function moveStepUp(index: number) {
    if (index === 0) return;
    const newSteps = [...steps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[index - 1];
    newSteps[index - 1] = temp;
    setSteps(newSteps);
    if (currentStepIndex === index) {
      setCurrentStepIndex(index - 1);
    } else if (currentStepIndex === index - 1) {
      setCurrentStepIndex(index);
    }
  }

  function moveStepDown(index: number) {
    if (index === steps.length - 1) return;
    const newSteps = [...steps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[index + 1];
    newSteps[index + 1] = temp;
    setSteps(newSteps);
    if (currentStepIndex === index) {
      setCurrentStepIndex(index + 1);
    } else if (currentStepIndex === index + 1) {
      setCurrentStepIndex(index);
    }
  }

  const handleModeChange = (val: string) => {
    const nextMode = val as "single" | "flow";
    if (nextMode === "single" && steps.length > 1) {
      Modal.confirm({
        title: "Switch to Single Request?",
        content: "Only the first step will be kept. Other steps will be deleted.",
        onOk: () => {
          setSteps([steps[0]]);
          setCurrentStepIndex(0);
          setMode("single");
        }
      });
    } else {
      setMode(nextMode);
    }
  };

  const filtered = saved.filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()));
  const currentStep = steps[currentStepIndex] || steps[0];

  const updateCurrentStep = (patch: Partial<RequestStep>) => {
    setSteps(steps.map((s, idx) => idx === currentStepIndex ? { ...s, ...patch } as RequestStep : s));
  };

  return (
    <Row gutter={16} style={{ height: "100%" }}>
      {/* Collection sidebar */}
      <Col xs={24} md={6}>
        <Card size="small" styles={{ body: { padding: 8 } }}
          title={<Space><span>Saved requests</span></Space>}
          extra={<Button size="small" type="primary" ghost icon={<FileAddOutlined />} onClick={reset}>New</Button>}>
          <Input.Search placeholder="filter" allowClear size="small" style={{ marginBottom: 8 }} onChange={(e) => setSearch(e.target.value)} />
          <List
            size="small"
            dataSource={filtered}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No saved requests" /> }}
            renderItem={(t) => {
              const cfgMethod = (t as any).method;
              return (
                <List.Item
                  onClick={() => load(t.id, t.name)}
                  style={{ cursor: "pointer", background: editingId === t.id ? "#e6f4ff" : undefined, paddingInline: 8, borderRadius: 4 }}
                >
                  <Space style={{ width: "100%", justifyContent: "space-between" }}>
                    <Space>
                      <Tag color={METHOD_COLOR[cfgMethod] || "default"} style={{ marginRight: 0, minWidth: 46, textAlign: "center" }}>
                        {cfgMethod || "FLOW"}
                      </Tag>
                      <Typography.Text ellipsis style={{ maxWidth: 120 }}>{t.name}</Typography.Text>
                    </Space>
                  </Space>
                </List.Item>
              );
            }}
          />
        </Card>
      </Col>

      {/* Editor */}
      <Col xs={24} md={18}>
        <Space style={{ marginBottom: 8, justifyContent: "space-between", width: "100%" }}>
          <Space>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {editingId ? editingName : "New request"}
            </Typography.Title>
            {editingId && <Tag color="blue">saved</Tag>}
            <Segmented
              options={[
                { label: "Single Request", value: "single" },
                { label: "Multi-step Flow", value: "flow" }
              ]}
              value={mode}
              onChange={handleModeChange}
            />
          </Space>
          <Space>
            {editingId ? (
              <Button icon={<SaveOutlined />} loading={update.isPending} onClick={() => update.mutate()}>Update</Button>
            ) : (
              <Button icon={<SaveOutlined />} onClick={() => setSaveOpen(true)}>Save</Button>
            )}
            <Tooltip title={editingId ? "" : "Save the request first"}>
              <Button icon={<ClockCircleOutlined />} disabled={!editingId} onClick={() => setSchedOpen(true)}>Schedule</Button>
            </Tooltip>
            {editingId && (
              <Popconfirm title="Delete this saved request?" onConfirm={() => remove.mutate()}>
                <Button danger icon={<DeleteOutlined />} loading={remove.isPending}>Delete</Button>
              </Popconfirm>
            )}
          </Space>
        </Space>

        <Card size="small" style={{ marginBottom: 16 }}>
          {mode === "flow" ? (
            <Row gutter={12}>
              {/* Flow Steps Sidebar */}
              <Col span={6} style={{ borderRight: "1px solid #f0f0f0", paddingRight: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Typography.Text strong>Flow Steps</Typography.Text>
                  <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={addStep} />
                </div>
                <List
                  size="small"
                  dataSource={steps}
                  renderItem={(item, idx) => (
                    <List.Item
                      onClick={() => setCurrentStepIndex(idx)}
                      style={{
                        cursor: "pointer",
                        background: currentStepIndex === idx ? "#e6f4ff" : undefined,
                        paddingInline: 8,
                        borderRadius: 4,
                        marginBottom: 4,
                      }}
                      actions={[
                        <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={idx === 0} onClick={(e) => { e.stopPropagation(); moveStepUp(idx); }} />,
                        <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={idx === steps.length - 1} onClick={(e) => { e.stopPropagation(); moveStepDown(idx); }} />,
                        <Button size="small" type="text" icon={<CopyOutlined />} onClick={(e) => { e.stopPropagation(); duplicateStep(idx); }} />,
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={steps.length <= 1} onClick={(e) => { e.stopPropagation(); deleteStep(idx); }} />
                      ]}
                    >
                      <Space>
                        <Tag color={METHOD_COLOR[item.method]} style={{ marginRight: 0, minWidth: 46, textAlign: "center", fontSize: 10 }}>
                          {item.method}
                        </Tag>
                        <Typography.Text ellipsis style={{ maxWidth: 80, fontSize: 12 }}>{item.name}</Typography.Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </Col>
              {/* Selected Step Editor */}
              <Col span={18}>
                <Space style={{ marginBottom: 8, display: "flex", width: "100%", justifyContent: "space-between" }}>
                  <Space>
                    <Typography.Text strong>Step Name:</Typography.Text>
                    <Input size="small" value={currentStep.name} onChange={(e) => updateCurrentStep({ name: e.target.value })} style={{ width: 180 }} />
                  </Space>
                  <Space>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>Step ID:</Typography.Text>
                    <Input size="small" value={currentStep.id} onChange={(e) => updateCurrentStep({ id: e.target.value })} style={{ width: 120 }} />
                  </Space>
                </Space>
                <Space.Compact style={{ width: "100%" }}>
                  <Select value={currentStep.method} onChange={(v) => updateCurrentStep({ method: v })} style={{ width: 100 }} options={METHODS.map((m) => ({ value: m }))} />
                  <Select allowClear placeholder="target" value={currentStep.target} onChange={(v) => updateCurrentStep({ target: v })} style={{ width: 140 }}
                    options={targets.map((t) => ({ value: t.key, label: `${t.key}` }))} />
                  <Input value={currentStep.url} onChange={(e) => updateCurrentStep({ url: e.target.value })} placeholder="{{base_url}}/path or absolute URL" />
                  <Button type="primary" icon={<SendOutlined />} loading={send.isPending} onClick={() => send.mutate()}>Send Flow</Button>
                </Space.Compact>

                <Tabs style={{ marginTop: 12 }} items={[
                  { key: "headers", label: `Headers (${(currentStep.headers || []).filter((h) => h.name).length})`, children: <KVEditor rows={currentStep.headers || []} setRows={(r) => updateCurrentStep({ headers: r })} /> },
                  { key: "query", label: `Params (${(currentStep.query || []).filter((q) => q.name).length})`, children: <KVEditor rows={currentStep.query || []} setRows={(r) => updateCurrentStep({ query: r })} /> },
                  { key: "auth", label: `Auth (${currentStep.auth?.type && currentStep.auth.type !== "none" ? "1" : "0"})`, children: <AuthEditor value={currentStep.auth || { type: "none" }} onChange={(v) => updateCurrentStep({ auth: v })} /> },
                  {
                    key: "body", label: "Body",
                    children: (
                      <div>
                        <Segmented options={["none", "json", "text", "form", "graphql"]} value={currentStep.bodyMode || "none"} onChange={(v) => updateCurrentStep({ bodyMode: v as any })} />
                        {(currentStep.bodyMode || "none") !== "none" && <Input.TextArea rows={6} style={{ marginTop: 8, fontFamily: "monospace" }} value={currentStep.bodyRaw || ""} onChange={(e) => updateCurrentStep({ bodyRaw: e.target.value })} placeholder='{"key": "value"}' />}
                      </div>
                    ),
                  },
                  { key: "assertions", label: `Assertions (${(currentStep.assertions || []).length})`, children: <AssertionEditor rows={currentStep.assertions || []} setRows={(r) => updateCurrentStep({ assertions: r })} /> },
                  { key: "captures", label: `Captures (${(currentStep.captures || []).length})`, children: <CaptureEditor rows={currentStep.captures || []} setRows={(r) => updateCurrentStep({ captures: r })} /> },
                ]} />
              </Col>
            </Row>
          ) : (
            <div>
              <Space.Compact style={{ width: "100%" }}>
                <Select value={currentStep.method} onChange={(v) => updateCurrentStep({ method: v })} style={{ width: 110 }} options={METHODS.map((m) => ({ value: m }))} />
                <Select allowClear placeholder="target" value={currentStep.target} onChange={(v) => updateCurrentStep({ target: v })} style={{ width: 160 }}
                  options={targets.map((t) => ({ value: t.key, label: `${t.key}` }))} />
                <Input value={currentStep.url} onChange={(e) => updateCurrentStep({ url: e.target.value })} placeholder="{{base_url}}/path or absolute URL" />
                <Button type="primary" icon={<SendOutlined />} loading={send.isPending} onClick={() => send.mutate()}>Send</Button>
              </Space.Compact>

              <Tabs style={{ marginTop: 12 }} items={[
                { key: "headers", label: `Headers (${(currentStep.headers || []).filter((h) => h.name).length})`, children: <KVEditor rows={currentStep.headers || []} setRows={(r) => updateCurrentStep({ headers: r })} /> },
                { key: "query", label: `Params (${(currentStep.query || []).filter((q) => q.name).length})`, children: <KVEditor rows={currentStep.query || []} setRows={(r) => updateCurrentStep({ query: r })} /> },
                { key: "auth", label: `Auth (${currentStep.auth?.type && currentStep.auth.type !== "none" ? "1" : "0"})`, children: <AuthEditor value={currentStep.auth || { type: "none" }} onChange={(v) => updateCurrentStep({ auth: v })} /> },
                {
                  key: "body", label: "Body",
                  children: (
                    <div>
                      <Segmented options={["none", "json", "text", "form", "graphql"]} value={currentStep.bodyMode || "none"} onChange={(v) => updateCurrentStep({ bodyMode: v as any })} />
                      {(currentStep.bodyMode || "none") !== "none" && <Input.TextArea rows={6} style={{ marginTop: 8, fontFamily: "monospace" }} value={currentStep.bodyRaw || ""} onChange={(e) => updateCurrentStep({ bodyRaw: e.target.value })} placeholder='{"key": "value"}' />}
                    </div>
                  ),
                },
                { key: "assertions", label: `Assertions (${(currentStep.assertions || []).length})`, children: <AssertionEditor rows={currentStep.assertions || []} setRows={(r) => updateCurrentStep({ assertions: r })} /> },
                { key: "captures", label: `Captures (${(currentStep.captures || []).length})`, children: <CaptureEditor rows={currentStep.captures || []} setRows={(r) => updateCurrentStep({ captures: r })} /> },
              ]} />
            </div>
          )}
        </Card>

        {result && <ResponseView result={result} />}
      </Col>

      <Modal title="Save as request test" open={saveOpen} onCancel={() => setSaveOpen(false)}
        onOk={() => saveForm.validateFields().then((v) => create.mutate(v.name))} confirmLoading={create.isPending}>
        <Form form={saveForm} layout="vertical">
          <Form.Item name="name" label="Test name" rules={[{ required: true }]}><Input placeholder="e.g. Orders API creates order" /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`Schedule "${editingName}"`} open={schedOpen} onCancel={() => setSchedOpen(false)}
        onOk={() => schedForm.validateFields().then((v) => schedule.mutate(v))} confirmLoading={schedule.isPending}>
        <Form form={schedForm} layout="vertical" initialValues={{ recurrence_type: "interval", interval_seconds: 300, is_enabled: true }}>
          <Form.Item name="name" label="Schedule name"><Input placeholder="optional" /></Form.Item>
          <Form.Item name="recurrence_type" label="Recurrence"><Select options={["interval", "cron", "once"].map((v) => ({ value: v }))} /></Form.Item>
          {schedType === "interval" && <Form.Item name="interval_seconds" label="Interval (seconds)" rules={[{ required: true }]}><InputNumber min={5} style={{ width: "100%" }} /></Form.Item>}
          {schedType === "cron" && <Form.Item name="cron_expression" label="Cron" rules={[{ required: true }]}><Input placeholder="*/5 * * * *" /></Form.Item>}
        </Form>
      </Modal>
    </Row>
  );
}

function coerce(v?: string): any {
  if (v === undefined || v === "") return v;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}

function KVEditor({ rows, setRows }: { rows: KV[]; setRows: (r: KV[]) => void }) {
  const upd = (i: number, patch: Partial<KV>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div>
      {rows.map((r, i) => (
        <Space key={i} style={{ display: "flex", marginBottom: 6 }}>
          <Input placeholder="name" value={r.name} onChange={(e) => upd(i, { name: e.target.value })} style={{ width: 220 }} />
          <Input placeholder="value" value={r.value} onChange={(e) => upd(i, { value: e.target.value })} style={{ width: 320 }} />
          <Button icon={<DeleteOutlined />} onClick={() => setRows(rows.filter((_, j) => j !== i))} />
        </Space>
      ))}
      <Button icon={<PlusOutlined />} onClick={() => setRows([...rows, { name: "", value: "", enabled: true }])}>Add item</Button>
    </div>
  );
}

function AssertionEditor({ rows, setRows }: { rows: Assn[]; setRows: (r: Assn[]) => void }) {
  const upd = (i: number, patch: Partial<Assn>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div>
      {rows.map((r, i) => (
        <Space key={i} style={{ display: "flex", marginBottom: 6 }} wrap>
          <Select value={r.type} onChange={(v) => upd(i, { type: v })} style={{ width: 150 }} options={SOURCES.map((s) => ({ value: s }))} />
          {(r.type === "json_path" || r.type === "header") &&
            <Input placeholder={r.type === "json_path" ? "$.path.to.field" : "Header-Name"} value={r.path} onChange={(e) => upd(i, { path: e.target.value })} style={{ width: 200 }} />}
          <Select value={r.operator} onChange={(v) => upd(i, { operator: v })} style={{ width: 130 }} options={OPERATORS.map((o) => ({ value: o }))} />
          <Input placeholder="expected" value={r.expected} onChange={(e) => upd(i, { expected: e.target.value })} style={{ width: 160 }} />
          <Button icon={<DeleteOutlined />} onClick={() => setRows(rows.filter((_, j) => j !== i))} />
        </Space>
      ))}
      <Button icon={<PlusOutlined />} onClick={() => setRows([...rows, { type: "status_code", operator: "equals", expected: "200" }])}>Add assertion</Button>
    </div>
  );
}

function CaptureEditor({ rows, setRows }: { rows: Capture[]; setRows: (r: Capture[]) => void }) {
  const upd = (i: number, patch: Partial<Capture>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } as Capture : r)));
  return (
    <div>
      {rows.map((r, i) => (
        <Space key={i} style={{ display: "flex", marginBottom: 6 }} wrap>
          <Input placeholder="variable name (e.g. token)" value={r.name} onChange={(e) => upd(i, { name: e.target.value })} style={{ width: 180 }} />
          <Select value={r.source} onChange={(v) => upd(i, { source: v })} style={{ width: 140 }}
            options={[
              { value: "json_path", label: "JSON Path" },
              { value: "header", label: "Header" },
              { value: "body_text", label: "Body Text" }
            ]} />
          {r.source !== "body_text" && (
            <Input placeholder={r.source === "json_path" ? "$.access_token" : "Header-Name"} value={r.path} onChange={(e) => upd(i, { path: e.target.value })} style={{ width: 220 }} />
          )}
          <Button icon={<DeleteOutlined />} onClick={() => setRows(rows.filter((_, j) => j !== i))} />
        </Space>
      ))}
      <Button icon={<PlusOutlined />} onClick={() => setRows([...rows, { name: "", source: "json_path", path: "", optional: false }])}>Add capture</Button>
    </div>
  );
}

function AuthEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const atype = value?.type || "none";
  const upd = (patch: any) => onChange({ ...value, ...patch });
  return (
    <div>
      <Segmented
        options={[
          { label: "None", value: "none" },
          { label: "Bearer Token", value: "bearer" },
          { label: "Basic Auth", value: "basic" },
          { label: "API Key", value: "apikey" }
        ]}
        value={atype}
        onChange={(v) => onChange({ type: v })}
        style={{ marginBottom: 12 }}
      />
      {atype === "bearer" && (
        <Form.Item label="Token (or Secret reference)" style={{ marginBottom: 0 }}>
          <Input placeholder="token or {{secret_ref}}" value={value?.tokenSecretRef || value?.token || ""}
            onChange={(e) => upd({ tokenSecretRef: e.target.value, token: e.target.value })} />
        </Form.Item>
      )}
      {atype === "basic" && (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Form.Item label="Username" style={{ marginBottom: 0 }}>
            <Input placeholder="username" value={value?.username || ""} onChange={(e) => upd({ username: e.target.value })} />
          </Form.Item>
          <Form.Item label="Password" style={{ marginBottom: 0 }}>
            <Input.Password placeholder="password" value={value?.password || ""} onChange={(e) => upd({ password: e.target.value })} />
          </Form.Item>
        </Space>
      )}
      {atype === "apikey" && (
        <Space style={{ display: "flex" }}>
          <Form.Item label="Header Name" style={{ marginBottom: 0 }}>
            <Input placeholder="X-API-Key" value={value?.headerName || "X-API-Key"} onChange={(e) => upd({ headerName: e.target.value })} style={{ width: 180 }} />
          </Form.Item>
          <Form.Item label="Value" style={{ marginBottom: 0 }}>
            <Input placeholder="key value" value={value?.value || ""} onChange={(e) => upd({ value: e.target.value })} style={{ width: 300 }} />
          </Form.Item>
        </Space>
      )}
    </div>
  );
}

function ResponseView({ result }: { result: SendResult }) {
  const [selectedResultStepIdx, setSelectedResultStepIdx] = useState<number>(0);
  const r = result.response || {};
  const isFlow = Array.isArray(r.steps) && r.steps.length > 0;

  if (isFlow) {
    const stepResponse = r.steps[selectedResultStepIdx] || r.steps[0] || {};
    const stepRespData = stepResponse.response || {};
    const stepAssertions = result.assertions.filter((a) => {
      return a.target?.startsWith(`${stepResponse.id}:`) || stepResponse.id === "request";
    });

    return (
      <Card size="small" title={
        <Space>Flow Execution Result <Tag color={result.status === "passed" ? "success" : "error"}>{result.status}</Tag>
          {r.elapsed_ms != null && <Tag>{r.elapsed_ms} ms total</Tag>}
        </Space>}>
        {result.error_message && <Alert type="error" message={result.error_message} style={{ marginBottom: 12 }} />}
        <Row gutter={16}>
          <Col span={6} style={{ borderRight: "1px solid #f0f0f0", paddingRight: 12 }}>
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>Steps</Typography.Text>
            <List
              size="small"
              dataSource={r.steps}
              renderItem={(s: any, idx) => (
                <List.Item
                  onClick={() => setSelectedResultStepIdx(idx)}
                  style={{
                    cursor: "pointer",
                    background: selectedResultStepIdx === idx ? "#e6f4ff" : undefined,
                    paddingInline: 8,
                    borderRadius: 4,
                    marginBottom: 4,
                  }}
                >
                  <Space style={{ width: "100%", justifyContent: "space-between" }}>
                    <Typography.Text ellipsis style={{ maxWidth: 120 }}>{s.name}</Typography.Text>
                    <Tag color={s.status === "passed" ? "success" : "error"}>{s.status === "passed" ? "✓" : "✗"}</Tag>
                  </Space>
                </List.Item>
              )}
            />
          </Col>
          <Col span={18}>
            <div style={{ marginBottom: 12 }}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                {stepResponse.name} <Tag color={METHOD_COLOR[stepResponse.method]}>{stepResponse.method}</Tag>
              </Typography.Title>
              <Typography.Text code ellipsis style={{ display: "block", marginTop: 4, maxWidth: "100%" }}>
                {stepResponse.url}
              </Typography.Text>
              <Space style={{ marginTop: 8 }}>
                {stepRespData.status_code != null && <Tag>Status: {stepRespData.status_code}</Tag>}
                {stepRespData.elapsed_ms != null && <Tag>Time: {stepRespData.elapsed_ms} ms</Tag>}
              </Space>
              {stepResponse.error_message && <Alert type="error" message={stepResponse.error_message} style={{ marginTop: 8 }} />}
            </div>
            <Row gutter={16}>
              <Col span={14}>
                <Typography.Text type="secondary">Body</Typography.Text>
                <pre className="qtp-code" style={{ maxHeight: 320 }}>{(stepRespData.body_text || "").slice(0, 5000) || "(empty)"}</pre>
              </Col>
              <Col span={10}>
                <Typography.Text type="secondary">Assertions</Typography.Text>
                <Table rowKey={(_, i) => String(i)} size="small" pagination={false} dataSource={stepAssertions}
                  columns={[
                    { title: "Check", render: (_, a) => {
                      const cleanTarget = a.target?.includes(":") ? a.target.split(":").slice(1).join(":") : a.target;
                      return `${a.source}${cleanTarget ? " " + cleanTarget : ""} ${a.operator} ${a.expected ?? ""}`;
                    }},
                    { title: "Actual", dataIndex: "actual", render: (v) => <Typography.Text code>{JSON.stringify(v)}</Typography.Text> },
                    { title: "", dataIndex: "passed", width: 40, render: (p) => <Tag color={p ? "success" : "error"}>{p ? "✓" : "✗"}</Tag> },
                  ]} />
                {stepResponse.captures && stepResponse.captures.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Typography.Text type="secondary">Captured Variables</Typography.Text>
                    <List size="small" dataSource={stepResponse.captures} renderItem={(capName: any) => (
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
      </Card>
    );
  }

  const allPass = result.assertions.every((a) => a.passed);
  return (
    <Card size="small" title={
      <Space>Response <Tag color={result.status === "passed" ? "success" : "error"}>{result.status}</Tag>
        {r.status_code != null && <Tag>{r.status_code}</Tag>}
        {r.elapsed_ms != null && <Tag>{r.elapsed_ms} ms</Tag>}
      </Space>}>
      {result.error_message && <Alert type="error" message={result.error_message} style={{ marginBottom: 12 }} />}
      <Row gutter={16}>
        <Col span={14}>
          <Typography.Text type="secondary">Body</Typography.Text>
          <pre className="qtp-code" style={{ maxHeight: 320 }}>{(r.body_text || "").slice(0, 5000) || "(empty)"}</pre>
        </Col>
        <Col span={10}>
          <Typography.Text type="secondary">Assertions {allPass ? "✓" : "✗"}</Typography.Text>
          <Table rowKey={(_, i) => String(i)} size="small" pagination={false} dataSource={result.assertions}
            columns={[
              { title: "Check", render: (_, a) => `${a.source}${a.target ? " " + a.target : ""} ${a.operator} ${a.expected ?? ""}` },
              { title: "Actual", dataIndex: "actual", render: (v) => <Typography.Text code>{JSON.stringify(v)}</Typography.Text> },
              { title: "", dataIndex: "passed", width: 40, render: (p) => <Tag color={p ? "success" : "error"}>{p ? "✓" : "✗"}</Tag> },
            ]} />
        </Col>
      </Row>
    </Card>
  );
}
