import { Table, Typography, Button, Space, Modal, Form, Input, App, Tag } from "antd";
import { PlusOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { qtp } from "../api/qtp";
import { antSortOrder, nextTableParams, textFilter } from "../components/remoteTable";
import type { QueryParams } from "../api/types";

export default function TargetsPage() {
  const { message } = App.useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [runTarget, setRunTarget] = useState<any>(null);
  const [form] = Form.useForm();
  const [params, setParams] = useState<QueryParams>({ page: 1, page_size: 20, sort: "name", order: "asc" });
  const { data: page, isLoading } = useQuery({ queryKey: ["targetsPage", params], queryFn: () => qtp.targetsPage(params) });

  const create = useMutation({
    mutationFn: (v: any) => qtp.createTarget({ ...v, tags: v.tags ? v.tags.split(",").map((s: string) => s.trim()).filter(Boolean) : [] }),
    onSuccess: () => { message.success("Target created"); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ["targetsPage"] }); qc.invalidateQueries({ queryKey: ["targetsOptions"] }); },
    onError: (e: any) => message.error(e.message || "failed"),
  });

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Targets</Typography.Title>
          <Typography.Text type="secondary">Applications under test. Click a target for tests, runs, ratios, and charts.</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>New target</Button>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={page?.items || []}
        onRow={(r) => ({ onClick: () => nav(`/targets/${r.id}`), style: { cursor: "pointer" } })}
        pagination={{ current: page?.page || 1, pageSize: page?.page_size || 20, total: page?.total || 0, showSizeChanger: true }}
        onChange={(pagination, filters, sorter: any, extra) => setParams((p) => nextTableParams(
          p,
          pagination,
          filters,
          sorter,
          extra,
          { key: "key", name: "name", base_url: "base_url", environment: "environment", tag: "tag" },
          { sort: "name", order: "asc", pageSize: 20 },
        ))}
        columns={[
          { title: "Key", dataIndex: "key", sorter: true, sortOrder: antSortOrder(params, "key"), ...textFilter("key", params, "Search key"), render: (v) => <Typography.Text code>{v}</Typography.Text> },
          { title: "Name", dataIndex: "name", sorter: true, sortOrder: antSortOrder(params, "name"), ...textFilter("name", params, "Search name"), render: (v) => <a>{v}</a> },
          { title: "Scenarios", dataIndex: "test_count", sorter: true, sortOrder: antSortOrder(params, "test_count"), render: (v) => <Typography.Text strong>{v || 0}</Typography.Text> },
          { title: "Base URL", dataIndex: "base_url", sorter: true, sortOrder: antSortOrder(params, "base_url"), ...textFilter("base_url", params, "Search URL"), ellipsis: true },
          { title: "Environment", dataIndex: "environment", sorter: true, sortOrder: antSortOrder(params, "environment"), ...textFilter("environment", params, "Search environment") },
          { title: "Tags", dataIndex: "tags", sorter: true, sortOrder: antSortOrder(params, "tags"), ...textFilter("tag", params, "Search tag"), render: (t) => (t || []).map((x: string) => <Tag key={x}>{x}</Tag>) },
          {
            title: "Actions", key: "actions", width: 120, render: (_, r: any) => (
              <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={(e) => {
                e.stopPropagation();
                setRunTarget(r);
              }}>Run all</Button>
            )
          }
        ]}
      />

      <Modal title="New target" open={open} onCancel={() => setOpen(false)} onOk={() => form.validateFields().then((v) => create.mutate(v))} confirmLoading={create.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="key" label="Key" rules={[{ required: true }]}><Input placeholder="orders_api" /></Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input placeholder="Orders API (staging)" /></Form.Item>
          <Form.Item name="base_url" label="Base URL" rules={[{ required: true }]}><Input placeholder="https://staging.example.com" /></Form.Item>
          <Form.Item name="environment" label="Environment" initialValue="default"><Input /></Form.Item>
          <Form.Item name="tags" label="Tags (comma separated)"><Input placeholder="api, staging" /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Run all tests for ${runTarget?.name}`}
        open={!!runTarget}
        onCancel={() => setRunTarget(null)}
        footer={[
          <Button key="cancel" onClick={() => setRunTarget(null)}>Cancel</Button>,
          <Button key="async" type="default" onClick={() => {
            const r = runTarget;
            setRunTarget(null);
            qtp.runAllTargetTests(r.id, "default", false).then((res) => {
              message.success(`Queued ${res.items.length} tests`);
              nav("/runs");
            }).catch((err) => message.error(err.message || "Failed to run tests"));
          }}>Run Async</Button>,
          <Button key="sync" type="primary" onClick={() => {
            const r = runTarget;
            setRunTarget(null);
            const hide = message.loading(`Running tests synchronously...`, 0);
            qtp.runAllTargetTests(r.id, "default", true).then((res) => {
              hide();
              const passed = res.items.filter((i: any) => i.status === "passed").length;
              const failed = res.items.filter((i: any) => i.status === "failed").length;
              message.success(`Completed ${res.items.length} tests (Passed: ${passed}, Failed: ${failed})`);
            }).catch((err) => { hide(); message.error(err.message || "Failed to run tests") });
          }}>Run Sync</Button>
        ]}
      >
        <p>Choose how you would like to run the tests for this target:</p>
        <ul>
          <li><strong>Async:</strong> Queues the tests and redirects you to the Runs dashboard.</li>
          <li><strong>Sync:</strong> Blocks the UI and waits for all tests to complete, returning the final results directly.</li>
        </ul>
        <div style={{ marginTop: 24 }}>
          <Typography.Title level={5}>CI/CD Integration</Typography.Title>
          <Typography.Text type="secondary">To run this target from your CI pipeline, use the following cURL commands. Replace <code>$QTP_HOST</code> with your platform URL and <code>$QTP_TOKEN</code> with a valid API token.</Typography.Text>
          
          <div style={{ marginTop: 12 }}>
            <Typography.Text strong>Async execution:</Typography.Text>
            <Typography.Paragraph copyable={{ text: `curl -X POST "$QTP_HOST/api/targets/${runTarget?.id}/run-all" -H "Authorization: Bearer $QTP_TOKEN" -H "Content-Type: application/json" -d '{"environment": "default"}'` }} style={{ padding: '12px', background: '#f5f5f5', borderRadius: '6px', marginTop: 4 }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px' }}>
{`curl -X POST "$QTP_HOST/api/targets/${runTarget?.id}/run-all" \\
  -H "Authorization: Bearer $QTP_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"environment": "default"}'`}
              </pre>
            </Typography.Paragraph>
          </div>

          <div style={{ marginTop: 12 }}>
            <Typography.Text strong>Sync execution (waits for results):</Typography.Text>
            <Typography.Paragraph copyable={{ text: `curl -X POST "$QTP_HOST/api/targets/${runTarget?.id}/run-all?sync=true" -H "Authorization: Bearer $QTP_TOKEN" -H "Content-Type: application/json" -d '{"environment": "default"}'` }} style={{ padding: '12px', background: '#f5f5f5', borderRadius: '6px', marginTop: 4 }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px' }}>
{`curl -X POST "$QTP_HOST/api/targets/${runTarget?.id}/run-all?sync=true" \\
  -H "Authorization: Bearer $QTP_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"environment": "default"}'`}
              </pre>
            </Typography.Paragraph>
          </div>
        </div>
      </Modal>
    </div>
  );
}
