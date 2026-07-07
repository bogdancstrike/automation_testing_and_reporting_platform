import { useState } from "react";
import {
  Row, Col, Card, Select, Input, Button, Tabs, Table, Space, Typography,
  Tag, App, Modal, Form, Alert, Segmented, List, Popconfirm, InputNumber, Empty, Tooltip,
  Layout, theme, Divider, Dropdown, MenuProps, Splitter,
} from "antd";
import {
  SendOutlined, PlusOutlined, DeleteOutlined, SaveOutlined, ClockCircleOutlined,
  FileAddOutlined, ArrowUpOutlined, ArrowDownOutlined, CopyOutlined, PlayCircleOutlined,
  EditOutlined, MoreOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qtp } from "../api/qtp";
import type { SendResult } from "../api/types";

const { Header, Content, Sider } = Layout;

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const SOURCES = ["status_code", "json_path", "header", "body_text", "response_time_ms"];
const OPERATORS = ["equals", "not_equals", "contains", "not_contains", "matches", "exists",
  "not_exists", "gt", "gte", "lt", "lte", "length_gte", "length_lte"];
const METHOD_COLOR: Record<string, string> = {
  GET: "success", POST: "processing", PUT: "warning", PATCH: "gold", DELETE: "error", HEAD: "default", OPTIONS: "cyan",
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
    url: "{{base_url}}/api/status",
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
  const { token } = theme.useToken();
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
  const [renameOpen, setRenameOpen] = useState(false);
  const [targetContextId, setTargetContextId] = useState<string | null>(null);
  
  const [saveForm] = Form.useForm();
  const [schedForm] = Form.useForm();
  const [renameForm] = Form.useForm();
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
      headers: s.headers.filter((h) => h.name && h.enabled),
      query: s.query.filter((q) => q.name && q.enabled),
      auth: s.auth && s.auth.type !== "none" ? s.auth : undefined,
      body: s.bodyMode === "none" ? undefined : { mode: s.bodyMode, raw: s.bodyRaw },
      assertions: s.assertions.map((a) => ({ type: a.type, path: a.path, operator: a.operator, expected: coerce(a.expected) })),
      captures: s.captures.map((c) => ({ name: c.name, source: c.source, path: c.path || undefined, optional: c.optional })),
    }));

    if (mode === "single") {
      const step: any = stepsConfig[0] || {};
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
    mutationFn: (id?: string) => qtp.deleteRequestTest(id || editingId!),
    onSuccess: (_, id) => {
      message.success("Deleted");
      if (!id || id === editingId) reset();
      qc.invalidateQueries({ queryKey: ["reqtests"] });
    },
    onError: (e: any) => message.error(e.message || "delete failed"),
  });

  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const detail = await qtp.test(id);
      const cfg = detail.revisions[detail.revisions.length - 1]?.config || {};
      return qtp.createRequestTest({ name: `${detail.name} (Copy)`, config: cfg });
    },
    onSuccess: () => {
      message.success("Duplicated");
      qc.invalidateQueries({ queryKey: ["reqtests"] });
    },
    onError: (e: any) => message.error(e.message || "duplicate failed"),
  });

  const renameMut = useMutation({
    mutationFn: async ({ id, name }: { id: string, name: string }) => {
      const detail = await qtp.test(id);
      const cfg = detail.revisions[detail.revisions.length - 1]?.config || {};
      return qtp.updateRequestTest(id, { name, config: cfg });
    },
    onSuccess: (_, { id, name }) => {
      message.success("Renamed");
      if (editingId === id) setEditingName(name);
      setRenameOpen(false);
      qc.invalidateQueries({ queryKey: ["reqtests"] });
    },
    onError: (e: any) => message.error(e.message || "rename failed"),
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

  // @ts-ignore
  return (
    <Layout style={{ height: "calc(100vh - 64px)", background: "transparent" }}>
      <div style={{ width: 280, minWidth: 200, maxWidth: 500, resize: "horizontal", overflow: "hidden", borderRight: `1px solid ${token.colorBorderSecondary}`, background: "#fff", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 12px", borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <Space style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <Typography.Text strong>Collections</Typography.Text>
            <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={reset}>New</Button>
          </Space>
          <Input.Search placeholder="Search requests..." allowClear size="small" onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ padding: 12, height: "calc(100% - 100px)", overflowY: "auto" }}>
          <List
            size="small"
            dataSource={filtered}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No saved requests" /> }}
            renderItem={(t) => {
              const cfgMethod = (t as any).method;
              const menu: MenuProps = {
                items: [
                  { key: "rename", label: "Rename", icon: <EditOutlined />, onClick: (e) => { e.domEvent.stopPropagation(); setTargetContextId(t.id); renameForm.setFieldsValue({ name: t.name }); setRenameOpen(true); } },
                  { key: "duplicate", label: "Duplicate", icon: <CopyOutlined />, onClick: (e) => { e.domEvent.stopPropagation(); duplicate.mutate(t.id); } },
                  { type: "divider" },
                  { key: "delete", danger: true, label: "Delete", icon: <DeleteOutlined />, onClick: (e) => { e.domEvent.stopPropagation(); Modal.confirm({ title: "Delete request?", content: "Are you sure you want to delete this saved request?", onOk: () => remove.mutate(t.id) }); } },
                ]
              };
              return (
                <Dropdown menu={menu} trigger={["contextMenu"]}>
                  <List.Item
                    onClick={() => load(t.id, t.name)}
                    style={{ cursor: "pointer", background: editingId === t.id ? token.colorPrimaryBg : "transparent", padding: "6px 8px", borderRadius: 6, borderBottom: "none" }}
                  >
                    <Space style={{ width: "100%", justifyContent: "space-between" }}>
                      <Space>
                        <Typography.Text type="secondary" style={{ fontSize: 11, minWidth: 42, display: "inline-block" }}>
                          {cfgMethod || "FLOW"}
                        </Typography.Text>
                        <Typography.Text ellipsis={{ tooltip: t.name }} style={{ flex: 1, maxWidth: "100%" }}>{t.name}</Typography.Text>
                      </Space>
                    </Space>
                  </List.Item>
                </Dropdown>
              );
            }}
          />
        </div>
      </div>

      <Content style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header Bar */}
        <div style={{ padding: "12px 24px", background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Space>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {editingId ? editingName : "New request"}
            </Typography.Title>
            {editingId && <Tag color="blue" bordered={false}>saved</Tag>}
            <Segmented
              options={[{ label: "Single", value: "single" }, { label: "Flow", value: "flow" }]}
              value={mode}
              onChange={handleModeChange}
              size="small"
            />
          </Space>
          <Space>
            {editingId ? (
              <Button icon={<SaveOutlined />} loading={update.isPending} onClick={() => update.mutate()}>Save</Button>
            ) : (
              <Button icon={<SaveOutlined />} onClick={() => setSaveOpen(true)}>Save</Button>
            )}
            <Button icon={<ClockCircleOutlined />} disabled={!editingId} onClick={() => setSchedOpen(true)}>Schedule</Button>
            {editingId && (
              <Popconfirm title="Delete this saved request?" onConfirm={() => remove.mutate(editingId!)}>
                <Button danger icon={<DeleteOutlined />} loading={remove.isPending}></Button>
              </Popconfirm>
            )}
          </Space>
        </div>

        {/* Request Area */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Flow sidebar if enabled */}
          {mode === "flow" && (
            <div style={{ width: 220, borderRight: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgLayout, padding: 12, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Typography.Text strong>Steps</Typography.Text>
                <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={addStep} />
              </div>
              {steps.map((item, idx) => (
                <div key={item.id} onClick={() => setCurrentStepIndex(idx)} style={{ cursor: "pointer", background: currentStepIndex === idx ? token.colorBgContainer : "transparent", border: `1px solid ${currentStepIndex === idx ? token.colorPrimary : "transparent"}`, padding: "8px", borderRadius: 6, marginBottom: 8, boxShadow: currentStepIndex === idx ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <Typography.Text strong style={{ fontSize: 13 }} ellipsis>{item.name}</Typography.Text>
                  </div>
                  <Space style={{ fontSize: 11 }}>
                    <Tag color={METHOD_COLOR[item.method]} style={{ margin: 0, fontSize: 10 }}>{item.method}</Tag>
                  </Space>
                  {currentStepIndex === idx && (
                    <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end", gap: 4 }}>
                      <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={idx === 0} onClick={(e) => { e.stopPropagation(); moveStepUp(idx); }} />
                      <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={idx === steps.length - 1} onClick={(e) => { e.stopPropagation(); moveStepDown(idx); }} />
                      <Button size="small" type="text" icon={<CopyOutlined />} onClick={(e) => { e.stopPropagation(); duplicateStep(idx); }} />
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={steps.length <= 1} onClick={(e) => { e.stopPropagation(); deleteStep(idx); }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Main Request Pane */}
          <Splitter layout="vertical" style={{ flex: 1 }}>
            <Splitter.Panel style={{ overflowY: "auto", padding: 24, background: token.colorBgContainer }}>
              {mode === "flow" && (
                <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
                  <Space>
                    <Typography.Text type="secondary">Step Name:</Typography.Text>
                    <Input size="small" value={currentStep.name} onChange={(e) => updateCurrentStep({ name: e.target.value })} style={{ width: 220 }} />
                  </Space>
                  <Typography.Text type="secondary" code>{currentStep.id}</Typography.Text>
                </Space>
              )}

              {/* URL Bar */}
              <div style={{ display: "flex", gap: 0, marginBottom: 24 }}>
                <Select value={currentStep.method} onChange={(v) => updateCurrentStep({ method: v })} style={{ width: 120 }} size="large" options={METHODS.map((m) => ({ value: m }))} />
                <Select allowClear placeholder="Target (optional)" value={currentStep.target} onChange={(v) => {
                  const target = targets.find(t => t.key === v);
                  const newUrl = target?.base_url && currentStep.url.includes("{{base_url}}") 
                    ? currentStep.url.replace("{{base_url}}", target.base_url) 
                    : currentStep.url;
                  updateCurrentStep({ target: v, url: newUrl });
                }} style={{ width: 180 }} size="large" options={targets.map((t) => ({ value: t.key, label: t.key }))} />
                <Input value={currentStep.url} onChange={(e) => updateCurrentStep({ url: e.target.value })} placeholder="Enter request URL" size="large" style={{ flex: 1, borderRadius: 0 }} />
                <Button type="primary" size="large" icon={<SendOutlined />} loading={send.isPending} onClick={() => send.mutate()} style={{ borderRadius: "0 6px 6px 0" }}>
                  {mode === "flow" ? "Send Flow" : "Send"}
                </Button>
              </div>

              {/* Tabs for Request Details */}
              <Tabs items={[
                { key: "query", label: `Params`, children: <KVEditor rows={currentStep.query || []} setRows={(r) => updateCurrentStep({ query: r })} /> },
                { key: "auth", label: `Authorization`, children: <AuthEditor value={currentStep.auth || { type: "none" }} onChange={(v) => updateCurrentStep({ auth: v })} /> },
                { key: "headers", label: `Headers`, children: <KVEditor rows={currentStep.headers || []} setRows={(r) => updateCurrentStep({ headers: r })} /> },
                {
                  key: "body", label: "Body",
                  children: (
                    <div>
                      <Segmented options={["none", "json", "text", "form", "graphql"]} value={currentStep.bodyMode || "none"} onChange={(v) => updateCurrentStep({ bodyMode: v as any })} />
                      {(currentStep.bodyMode || "none") !== "none" && <Input.TextArea rows={8} style={{ marginTop: 12, fontFamily: "monospace", background: "#fafafa" }} value={currentStep.bodyRaw || ""} onChange={(e) => updateCurrentStep({ bodyRaw: e.target.value })} placeholder='{"key": "value"}' />}
                    </div>
                  ),
                },
                { key: "assertions", label: `Assertions (${(currentStep.assertions || []).length})`, children: <AssertionEditor rows={currentStep.assertions || []} setRows={(r) => updateCurrentStep({ assertions: r })} /> },
                { key: "captures", label: `Captures (${(currentStep.captures || []).length})`, children: <CaptureEditor rows={currentStep.captures || []} setRows={(r) => updateCurrentStep({ captures: r })} /> },
              ]} />
            </Splitter.Panel>

            {/* Response Area Container (Splitter) */}
            <Splitter.Panel defaultSize="40%" min="20%" style={{ background: "#fafafa", overflowY: "auto", position: "relative", borderTop: `1px solid ${token.colorBorderSecondary}` }}>
              {!result ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: token.colorTextQuaternary }}>
                  <Space direction="vertical" align="center">
                    <SendOutlined style={{ fontSize: 32 }} />
                    <Typography.Text type="secondary">Enter the URL and click Send to get a response</Typography.Text>
                  </Space>
                </div>
              ) : (
                <ResponseView result={result} />
              )}
            </Splitter.Panel>
          </Splitter>
        </div>
      </Content>

      <Modal title="Save Request" open={saveOpen} onCancel={() => setSaveOpen(false)}
        onOk={() => saveForm.validateFields().then((v) => create.mutate(v.name))} confirmLoading={create.isPending}>
        <Form form={saveForm} layout="vertical">
          <Form.Item name="name" label="Test Name" rules={[{ required: true }]}><Input placeholder="e.g. Orders API creates order" /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Rename Request" open={renameOpen} onCancel={() => setRenameOpen(false)}
        onOk={() => renameForm.validateFields().then((v) => targetContextId && renameMut.mutate({ id: targetContextId, name: v.name }))} confirmLoading={renameMut.isPending}>
        <Form form={renameForm} layout="vertical">
          <Form.Item name="name" label="Test Name" rules={[{ required: true }]}><Input placeholder="New name" /></Form.Item>
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
    </Layout>
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
  const add = () => setRows([...rows, { name: "", value: "", enabled: true }]);
  return (
    <div>
      {rows.map((r, i) => (
        <Space key={i} style={{ display: "flex", marginBottom: 8 }}>
          <Input placeholder="Key" value={r.name} onChange={(e) => upd(i, { name: e.target.value })} style={{ width: 220 }} />
          <Input placeholder="Value" value={r.value} onChange={(e) => upd(i, { value: e.target.value })} style={{ width: 380 }} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setRows(rows.filter((_, j) => j !== i))} />
        </Space>
      ))}
      <Button type="dashed" icon={<PlusOutlined />} onClick={add} style={{ width: "100%", maxWidth: 640 }}>Add Item</Button>
    </div>
  );
}

function AssertionEditor({ rows, setRows }: { rows: Assn[]; setRows: (r: Assn[]) => void }) {
  const upd = (i: number, patch: Partial<Assn>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const add = () => setRows([...rows, { type: "status_code", operator: "equals", expected: "200" }]);
  return (
    <div>
      {rows.map((r, i) => (
        <Space key={i} style={{ display: "flex", marginBottom: 8 }} wrap>
          <Select value={r.type} onChange={(v) => upd(i, { type: v })} style={{ width: 160 }} options={SOURCES.map((s) => ({ value: s }))} />
          {(r.type === "json_path" || r.type === "header") &&
            <Input placeholder={r.type === "json_path" ? "$.path.to.field" : "Header-Name"} value={r.path} onChange={(e) => upd(i, { path: e.target.value })} style={{ width: 200 }} />}
          <Select value={r.operator} onChange={(v) => upd(i, { operator: v })} style={{ width: 140 }} options={OPERATORS.map((o) => ({ value: o }))} />
          <Input placeholder="Expected value" value={r.expected} onChange={(e) => upd(i, { expected: e.target.value })} style={{ width: 220 }} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setRows(rows.filter((_, j) => j !== i))} />
        </Space>
      ))}
      <Button type="dashed" icon={<PlusOutlined />} onClick={add} style={{ width: "100%", maxWidth: 800 }}>Add Assertion</Button>
    </div>
  );
}

function CaptureEditor({ rows, setRows }: { rows: Capture[]; setRows: (r: Capture[]) => void }) {
  const upd = (i: number, patch: Partial<Capture>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } as Capture : r)));
  const add = () => setRows([...rows, { name: "", source: "json_path", path: "", optional: false }]);
  return (
    <div>
      {rows.map((r, i) => (
        <Space key={i} style={{ display: "flex", marginBottom: 8 }} wrap>
          <Input placeholder="Variable name (e.g. token)" value={r.name} onChange={(e) => upd(i, { name: e.target.value })} style={{ width: 200 }} />
          <Select value={r.source} onChange={(v) => upd(i, { source: v })} style={{ width: 160 }}
            options={[
              { value: "json_path", label: "JSON Path" },
              { value: "header", label: "Header" },
              { value: "body_text", label: "Body Text" }
            ]} />
          {r.source !== "body_text" && (
            <Input placeholder={r.source === "json_path" ? "$.access_token" : "Header-Name"} value={r.path} onChange={(e) => upd(i, { path: e.target.value })} style={{ width: 260 }} />
          )}
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setRows(rows.filter((_, j) => j !== i))} />
        </Space>
      ))}
      <Button type="dashed" icon={<PlusOutlined />} onClick={add} style={{ width: "100%", maxWidth: 700 }}>Add Capture</Button>
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
          { label: "No Auth", value: "none" },
          { label: "Bearer Token", value: "bearer" },
          { label: "Basic Auth", value: "basic" },
          { label: "API Key", value: "apikey" }
        ]}
        value={atype}
        onChange={(v) => onChange({ type: v })}
        style={{ marginBottom: 16 }}
      />
      <div style={{ maxWidth: 400 }}>
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
          <Space direction="vertical" style={{ width: "100%" }}>
            <Form.Item label="Header Name" style={{ marginBottom: 0 }}>
              <Input placeholder="X-API-Key" value={value?.headerName || "X-API-Key"} onChange={(e) => upd({ headerName: e.target.value })} />
            </Form.Item>
            <Form.Item label="Value" style={{ marginBottom: 0 }}>
              <Input placeholder="key value" value={value?.value || ""} onChange={(e) => upd({ value: e.target.value })} />
            </Form.Item>
          </Space>
        )}
      </div>
    </div>
  );
}

function ResponseView({ result }: { result: SendResult }) {
  const [selectedResultStepIdx, setSelectedResultStepIdx] = useState<number>(0);
  const { token } = theme.useToken();
  const r = result.response || {};
  const isFlow = Array.isArray(r.steps) && r.steps.length > 0;

  if (isFlow) {
    const stepResponse = r.steps[selectedResultStepIdx] || r.steps[0] || {};
    const stepRespData = stepResponse.response || {};
    const stepAssertions = result.assertions.filter((a) => {
      return a.target?.startsWith(`${stepResponse.id}:`) || stepResponse.id === "request";
    });

    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "8px 16px", background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}`, display: "flex", justifyContent: "space-between" }}>
          <Space>
            <Typography.Text strong>Flow Result</Typography.Text>
            <Tag color={result.status === "passed" ? "success" : "error"}>{result.status}</Tag>
          </Space>
          <Typography.Text type="secondary">{r.elapsed_ms != null ? `${r.elapsed_ms} ms total` : ""}</Typography.Text>
        </div>
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ width: 220, borderRight: `1px solid ${token.colorBorderSecondary}`, overflowY: "auto", background: token.colorBgContainer }}>
            <List
              size="small"
              dataSource={r.steps}
              renderItem={(s: any, idx) => (
                <List.Item onClick={() => setSelectedResultStepIdx(idx)} style={{ cursor: "pointer", background: selectedResultStepIdx === idx ? "#e6f4ff" : undefined, padding: "8px 16px" }}>
                  <Space style={{ width: "100%", justifyContent: "space-between" }}>
                    <Typography.Text ellipsis style={{ maxWidth: 120 }}>{s.name}</Typography.Text>
                    <Tag color={s.status === "passed" ? "success" : "error"} style={{ margin: 0 }}>{s.status === "passed" ? "✓" : "✗"}</Tag>
                  </Space>
                </List.Item>
              )}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
             <Typography.Title level={5} style={{ margin: 0 }}>
               <Tag color={METHOD_COLOR[stepResponse.method]}>{stepResponse.method}</Tag> {stepResponse.url}
             </Typography.Title>
             <Space style={{ marginTop: 8, marginBottom: 16 }}>
               {stepRespData.status_code != null && <Tag color={stepRespData.status_code >= 400 ? "error" : "success"}>Status: {stepRespData.status_code}</Tag>}
               {stepRespData.elapsed_ms != null && <Tag>Time: {stepRespData.elapsed_ms} ms</Tag>}
             </Space>
             <Row gutter={24}>
               <Col span={14}>
                 <Tabs items={[
                    { key: "body", label: "Body", children: <pre style={{ background: token.colorBgContainer, padding: 12, borderRadius: 6, border: `1px solid ${token.colorBorderSecondary}`, marginTop: 0, overflowX: "auto" }}>{(stepRespData.body_text || "").slice(0, 5000) || "(empty)"}</pre> },
                    { key: "headers", label: "Headers", children: <Empty description="Headers not implemented in preview" image={Empty.PRESENTED_IMAGE_SIMPLE} /> },
                    { key: "captures", label: "Captures", children: (stepRespData.captures && stepRespData.captures.length > 0) ? (<Space>{stepRespData.captures.map((c: string) => <Tag key={c} color="blue">{c}</Tag>)}</Space>) : <Typography.Text type="secondary">No variables captured</Typography.Text> }
                  ]} />
               </Col>
               <Col span={10}>
                 <Typography.Text strong>Assertions</Typography.Text>
                 <Table rowKey={(_, i) => String(i)} size="small" pagination={false} dataSource={stepAssertions} style={{ marginTop: 8 }}
                   columns={[
                     { title: "Check", render: (_, a) => {
                       const cleanTarget = a.target?.includes(":") ? a.target.split(":").slice(1).join(":") : a.target;
                       return `${a.source}${cleanTarget ? " " + cleanTarget : ""} ${a.operator} ${a.expected ?? ""}`;
                     }},
                     { title: "Passed", dataIndex: "passed", width: 60, render: (p) => <Tag color={p ? "success" : "error"}>{p ? "✓" : "✗"}</Tag> },
                   ]} />
               </Col>
             </Row>
          </div>
        </div>
      </div>
    );
  }

  const allPass = result.assertions.every((a) => a.passed);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 16px", background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}`, display: "flex", justifyContent: "space-between" }}>
        <Space>
          <Typography.Text strong>Response</Typography.Text>
          {r.status_code != null && <Typography.Text type={r.status_code >= 400 ? "danger" : "success"}>{r.status_code} {r.status_code >= 400 ? "Error" : "OK"}</Typography.Text>}
          {r.elapsed_ms != null && <Typography.Text type="secondary">{r.elapsed_ms} ms</Typography.Text>}
        </Space>
        <Tag color={result.status === "passed" ? "success" : "error"} style={{ margin: 0 }}>{result.status.toUpperCase()}</Tag>
      </div>


      <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
        {result.error_message && <Alert type="error" message={result.error_message} style={{ marginBottom: 16 }} />}
        <Row gutter={24}>
          <Col span={14}>
            <Tabs items={[
              { key: "body", label: "Body", children: <pre style={{ background: token.colorBgContainer, padding: 12, borderRadius: 6, border: `1px solid ${token.colorBorderSecondary}`, marginTop: 0, overflowX: "auto" }}>{(r.body_text || "").slice(0, 5000) || "(empty)"}</pre> },
              { key: "headers", label: "Headers", children: <Empty description="Headers not implemented in preview" image={Empty.PRESENTED_IMAGE_SIMPLE} /> },
              { key: "captures", label: "Captures", children: (r.captures && r.captures.length > 0) ? (<Space>{r.captures.map((c: string) => <Tag key={c} color="blue">{c}</Tag>)}</Space>) : <Typography.Text type="secondary">No variables captured</Typography.Text> }
            ]} />
          </Col>
          <Col span={10}>
            <Typography.Text strong style={{ display: "inline-block", marginBottom: 12 }}>Test Results</Typography.Text>
            <Table rowKey={(_, i) => String(i)} size="small" pagination={false} dataSource={result.assertions}
              columns={[
                { title: "Assertion Check", render: (_, a) => <Typography.Text style={{ fontSize: 13 }}>{`${a.source}${a.target ? " " + a.target : ""} ${a.operator} ${a.expected ?? ""}`}</Typography.Text> },
                { title: "Status", dataIndex: "passed", width: 80, render: (p) => <Tag color={p ? "success" : "error"}>{p ? "Pass" : "Fail"}</Tag> },
              ]} />
          </Col>
        </Row>
      </div>
    </div>
  );
}
