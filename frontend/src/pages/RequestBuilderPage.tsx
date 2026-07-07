import { useState } from "react";
import {
  Row, Col, Card, Select, Input, Button, Tabs, Table, Space, Typography,
  Tag, App, Modal, Form, Alert, Segmented,
} from "antd";
import { SendOutlined, PlusOutlined, DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { qtp } from "../api/qtp";
import type { SendResult } from "../api/types";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];
const SOURCES = ["status_code", "json_path", "header", "body_text", "response_time_ms"];
const OPERATORS = ["equals", "not_equals", "contains", "not_contains", "matches", "exists",
  "not_exists", "gt", "gte", "lt", "lte", "length_gte", "length_lte"];

type KV = { name: string; value: string; enabled: boolean };
type Assn = { type: string; path?: string; operator: string; expected?: string };

export default function RequestBuilderPage() {
  const { message } = App.useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: targets = [] } = useQuery({ queryKey: ["targets"], queryFn: qtp.targets });

  const [method, setMethod] = useState("GET");
  const [target, setTarget] = useState<string | undefined>();
  const [url, setUrl] = useState("{{base_url}}/get");
  const [headers, setHeaders] = useState<KV[]>([]);
  const [bodyMode, setBodyMode] = useState("none");
  const [bodyRaw, setBodyRaw] = useState("");
  const [assertions, setAssertions] = useState<Assn[]>([
    { type: "status_code", operator: "equals", expected: "200" },
  ]);
  const [result, setResult] = useState<SendResult | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [form] = Form.useForm();

  function buildConfig() {
    return {
      target,
      method,
      url,
      headers: headers.filter((h) => h.name),
      body: bodyMode === "none" ? undefined : { mode: bodyMode, raw: bodyRaw },
      assertions: assertions.map((a) => ({
        type: a.type, path: a.path, operator: a.operator,
        expected: coerce(a.expected),
      })),
    };
  }

  const send = useMutation({
    mutationFn: () => qtp.sendRequest(buildConfig()),
    onSuccess: setResult,
    onError: (e: any) => message.error(e.message || "send failed"),
  });

  const save = useMutation({
    mutationFn: (name: string) => qtp.createRequestTest({ name, config: buildConfig() }),
    onSuccess: (t) => { message.success("Saved as test"); qc.invalidateQueries({ queryKey: ["tests"] }); setSaveOpen(false); nav(`/tests/${t.id}`); },
    onError: (e: any) => message.error(e.message || "save failed"),
  });

  return (
    <div>
      <Typography.Title level={3}>Request Builder</Typography.Title>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: "100%" }}>
          <Select value={method} onChange={setMethod} style={{ width: 110 }} options={METHODS.map((m) => ({ value: m }))} />
          <Select allowClear placeholder="target" value={target} onChange={setTarget} style={{ width: 160 }}
            options={targets.map((t) => ({ value: t.key, label: `${t.key} (${t.base_url})` }))} />
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="{{base_url}}/path or absolute URL" />
          <Button type="primary" icon={<SendOutlined />} loading={send.isPending} onClick={() => send.mutate()}>Send</Button>
          <Button icon={<SaveOutlined />} onClick={() => setSaveOpen(true)}>Save</Button>
        </Space.Compact>

        <Tabs
          style={{ marginTop: 12 }}
          items={[
            {
              key: "headers", label: `Headers (${headers.filter((h) => h.name).length})`,
              children: <KVEditor rows={headers} setRows={setHeaders} />,
            },
            {
              key: "body", label: "Body",
              children: (
                <div>
                  <Segmented options={["none", "json", "text", "form", "graphql"]} value={bodyMode} onChange={(v) => setBodyMode(v as string)} />
                  {bodyMode !== "none" && (
                    <Input.TextArea rows={6} style={{ marginTop: 8, fontFamily: "monospace" }}
                      value={bodyRaw} onChange={(e) => setBodyRaw(e.target.value)} placeholder='{"key": "value"}' />
                  )}
                </div>
              ),
            },
            {
              key: "assertions", label: `Assertions (${assertions.length})`,
              children: <AssertionEditor rows={assertions} setRows={setAssertions} />,
            },
          ]}
        />
      </Card>

      {result && <ResponseView result={result} />}

      <Modal title="Save as request test" open={saveOpen} onCancel={() => setSaveOpen(false)}
        onOk={() => form.validateFields().then((v) => save.mutate(v.name))} confirmLoading={save.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Test name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Orders API creates order" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
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
      <Space>
        Response
        <Tag color={result.status === "passed" ? "success" : "error"}>{result.status}</Tag>
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
