import { Table, Typography, Button, Space, Modal, Form, Input, App, Tag } from "antd";
import { PlusOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { qtp } from "../api/qtp";
import type { QueryParams } from "../api/types";

function sortOrder(order?: string) { return order === "ascend" ? "asc" : order === "descend" ? "desc" : undefined; }

export default function TargetsPage() {
  const { message } = App.useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
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
      <Input.Search placeholder="search target key / name / URL" allowClear onSearch={(q) => setParams((p) => ({ ...p, q, page: 1 }))} style={{ width: 320, marginBottom: 12 }} />
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={page?.items || []}
        onRow={(r) => ({ onClick: () => nav(`/targets/${r.id}`), style: { cursor: "pointer" } })}
        pagination={{ current: page?.page || 1, pageSize: page?.page_size || 20, total: page?.total || 0, showSizeChanger: true }}
        onChange={(pagination, _filters, sorter: any) => setParams((p) => ({
          ...p, page: pagination.current || 1, page_size: pagination.pageSize || 20,
          sort: sorter?.field || p.sort, order: sortOrder(sorter?.order) || p.order,
        }))}
        columns={[
          { title: "Key", dataIndex: "key", sorter: true, render: (v) => <Typography.Text code>{v}</Typography.Text> },
          { title: "Name", dataIndex: "name", sorter: true, render: (v) => <a>{v}</a> },
          { title: "Tests Configured", dataIndex: "test_count", render: (v) => <Typography.Text strong>{v || 0}</Typography.Text> },
          { title: "Base URL", dataIndex: "base_url", sorter: true, ellipsis: true },
          { title: "Environment", dataIndex: "environment", sorter: true },
          { title: "Tags", dataIndex: "tags", render: (t) => (t || []).map((x: string) => <Tag key={x}>{x}</Tag>) },
          {
            title: "Actions", key: "actions", width: 120, render: (_, r: any) => (
              <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={(e) => {
                e.stopPropagation();
                qtp.runAllTargetTests(r.id).then((res) => {
                  message.success(`Queued ${res.items.length} tests`);
                  nav("/runs");
                }).catch((err) => message.error(err.message || "Failed to run tests"));
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
    </div>
  );
}
