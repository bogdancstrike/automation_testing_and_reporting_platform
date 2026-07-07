import { useState } from "react";
import {
  Row, Col, Card, Select, Input, Button, Tabs, Table, Space, Typography,
  Tag, App, Modal, Form, Alert, Segmented, List, Popconfirm, InputNumber, Empty, Tooltip,
} from "antd";
import {
  SendOutlined, PlusOutlined, DeleteOutlined, SaveOutlined, ClockCircleOutlined,
  FileAddOutlined,
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

const EMPTY = {
  method: "GET", target: undefined as string | undefined, url: "{{base_url}}/get",
  headers: [] as KV[], bodyMode: "none", bodyRaw: "",
  assertions: [{ type: "status_code", operator: "equals", expected: "200" }] as Assn[],
};

export default function RequestBuilderPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { data: targets = [] } = useQuery({ queryKey: ["targets"], queryFn: qtp.targets });
  const { data: saved = [] } = useQuery({ queryKey: ["reqtests"], queryFn: () => qtp.tests("?source=ui") });

  const [method, setMethod] = useState(EMPTY.method);
  const [target, setTarget] = useState<string | undefined>(EMPTY.target);
  const [url, setUrl] = useState(EMPTY.url);
  const [headers, setHeaders] = useState<KV[]>(EMPTY.headers);
  const [bodyMode, setBodyMode] = useState(EMPTY.bodyMode);
  const [bodyRaw, setBodyRaw] = useState(EMPTY.bodyRaw);
  const [assertions, setAssertions] = useState<Assn[]>(EMPTY.assertions);
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
    setMethod(EMPTY.method); setTarget(undefined); setUrl(EMPTY.url); setHeaders([]);
    setBodyMode("none"); setBodyRaw(""); setAssertions([...EMPTY.assertions]);
    setResult(null); setEditingId(null); setEditingName("Untitled request");
  }

  async function load(id: string, name: string) {
    const detail = await qtp.test(id);
    const cfg = detail.revisions[detail.revisions.length - 1]?.config || {};
    setEditingId(id); setEditingName(name);
    setMethod(cfg.method || "GET");
    setTarget(cfg.target);
    setUrl(cfg.url || "");
    setHeaders((cfg.headers || []).map((h: any) => ({ name: h.name, value: h.value, enabled: h.enabled !== false })));
    setBodyMode(cfg.body?.mode || "none");
    setBodyRaw(cfg.body?.raw || "");
    setAssertions((cfg.assertions || []).map((a: any) => ({
      type: a.type || a.source, path: a.path, operator: a.operator,
      expected: a.expected !== undefined ? String(a.expected) : undefined,
    })));
    setResult(null);
  }

  function buildConfig() {
    return {
      target, method, url,
      headers: headers.filter((h) => h.name),
      body: bodyMode === "none" ? undefined : { mode: bodyMode, raw: bodyRaw },
      assertions: assertions.map((a) => ({ type: a.type, path: a.path, operator: a.operator, expected: coerce(a.expected) })),
    };
  }

  const send = useMutation({ mutationFn: () => qtp.sendRequest(buildConfig()), onSuccess: setResult,
    onError: (e: any) => message.error(e.message || "send failed") });

  const create = useMutation({
    mutationFn: (name: string) => qtp.createRequestTest({ name, config: buildConfig() }),
    onSuccess: (t) => { message.success("Saved"); setSaveOpen(false); setEditingId(t.id); setEditingName(t.name); qc.invalidateQueries({ queryKey: ["reqtests"] }); },
    onError: (e: any) => message.error(e.message || "save failed"),
  });
  const update = useMutation({
    mutationFn: () => qtp.updateRequestTest(editingId!, { name: editingName, config: buildConfig() }),
    onSuccess: () => { message.success("Updated (new revision)"); qc.invalidateQueries({ queryKey: ["reqtests"] }); },
    onError: (e: any) => message.error(e.message || "update failed"),
  });
  const remove = useMutation({
    mutationFn: () => qtp.deleteRequestTest(editingId!),
    onSuccess: () => { message.success("Deleted"); reset(); qc.invalidateQueries({ queryKey: ["reqtests"] }); },
    onError: (e: any) => message.error(e.message || "delete failed"),
  });
  const schedule = useMutation({
    mutationFn: (v: any) => qtp.createSchedule({ test_definition_id: editingId!, ...v }),
    onSuccess: () => { message.success("Scheduled"); setSchedOpen(false); qc.invalidateQueries({ queryKey: ["schedules"] }); },
    onError: (e: any) => message.error(e.message || "schedule failed"),
  });

  const filtered = saved.filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Row gutter={16} style={{ height: "100%" }}>
      {/* Collection sidebar (Insomnia/Postman-like) */}
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
                  <Space>
                    <Tag color={METHOD_COLOR[cfgMethod] || "default"} style={{ marginRight: 0, minWidth: 46, textAlign: "center" }}>
                      {cfgMethod || "REQ"}
                    </Tag>
                    <Typography.Text ellipsis style={{ maxWidth: 150 }}>{t.name}</Typography.Text>
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
          <Typography.Title level={4} style={{ margin: 0 }}>
            {editingId ? editingName : "New request"} {editingId && <Tag color="blue">saved</Tag>}
          </Typography.Title>
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
          <Space.Compact style={{ width: "100%" }}>
            <Select value={method} onChange={setMethod} style={{ width: 110 }} options={METHODS.map((m) => ({ value: m }))} />
            <Select allowClear placeholder="target" value={target} onChange={setTarget} style={{ width: 160 }}
              options={targets.map((t) => ({ value: t.key, label: `${t.key}` }))} />
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="{{base_url}}/path or absolute URL" />
            <Button type="primary" icon={<SendOutlined />} loading={send.isPending} onClick={() => send.mutate()}>Send</Button>
          </Space.Compact>

          <Tabs style={{ marginTop: 12 }} items={[
            { key: "headers", label: `Headers (${headers.filter((h) => h.name).length})`, children: <KVEditor rows={headers} setRows={setHeaders} /> },
            {
              key: "body", label: "Body",
              children: (
                <div>
                  <Segmented options={["none", "json", "text", "form", "graphql"]} value={bodyMode} onChange={(v) => setBodyMode(v as string)} />
                  {bodyMode !== "none" && <Input.TextArea rows={6} style={{ marginTop: 8, fontFamily: "monospace" }} value={bodyRaw} onChange={(e) => setBodyRaw(e.target.value)} placeholder='{"key": "value"}' />}
                </div>
              ),
            },
            { key: "assertions", label: `Assertions (${assertions.length})`, children: <AssertionEditor rows={assertions} setRows={setAssertions} /> },
          ]} />
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
      <Button icon={<PlusOutlined />} onClick={() => setRows([...rows, { name: "", value: "", enabled: true }])}>Add header</Button>
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

function ResponseView({ result }: { result: SendResult }) {
  const r = result.response || {};
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
