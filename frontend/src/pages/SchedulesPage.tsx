import { Table, Typography, Button, Space, Modal, Form, Select, Input, InputNumber, Switch, App, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { qtp } from "../api/qtp";
import type { QueryParams } from "../api/types";

function sortOrder(order?: string) { return order === "ascend" ? "asc" : order === "descend" ? "desc" : undefined; }

export default function SchedulesPage() {
  const { message } = App.useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const rtype = Form.useWatch("recurrence_type", form);
  const [params, setParams] = useState<QueryParams>({ page: 1, page_size: 20, sort: "created_at", order: "desc" });

  const { data: page, isLoading } = useQuery({ queryKey: ["schedulesPage", params], queryFn: () => qtp.schedulesPage(params) });
  const { data: testsPage } = useQuery({ queryKey: ["testsOptions"], queryFn: () => qtp.testsPage({ page_size: 100, sort: "name", order: "asc" }) });
  const tests = testsPage?.items || [];

  const create = useMutation({
    mutationFn: (v: any) => qtp.createSchedule(v),
    onSuccess: () => { message.success("Schedule created"); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ["schedulesPage"] }); },
    onError: (e: any) => message.error(e.message || "failed"),
  });
  const toggle = useMutation({ mutationFn: (s: any) => qtp.updateSchedule(s.id, { is_enabled: !s.is_enabled }), onSuccess: () => qc.invalidateQueries({ queryKey: ["schedulesPage"] }) });
  const remove = useMutation({ mutationFn: (id: string) => qtp.deleteSchedule(id), onSuccess: () => { message.success("Deleted"); qc.invalidateQueries({ queryKey: ["schedulesPage"] }); } });

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Schedules</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>New schedule</Button>
      </Space>
      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search placeholder="search schedule / test" allowClear onSearch={(q) => setParams((p) => ({ ...p, q, page: 1 }))} style={{ width: 280 }} />
        <Select allowClear placeholder="recurrence" style={{ width: 150 }} onChange={(recurrence_type) => setParams((p) => ({ ...p, recurrence_type, page: 1 }))} options={["interval", "cron", "once"].map((value) => ({ value }))} />
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={page?.items || []}
        onRow={(r: any) => ({ onClick: () => nav(`/schedules/${r.id}`), style: { cursor: "pointer" } })}
        pagination={{ current: page?.page || 1, pageSize: page?.page_size || 20, total: page?.total || 0, showSizeChanger: true }}
        onChange={(pagination, _filters, sorter: any) => setParams((p) => ({ ...p, page: pagination.current || 1, page_size: pagination.pageSize || 20, sort: sorter?.field || p.sort, order: sortOrder(sorter?.order) || p.order }))}
        columns={[
          { title: "Name", dataIndex: "name", sorter: true },
          { title: "Test", dataIndex: "test_name" },
          { title: "Target", dataIndex: "target_key", render: (t) => t ? <Tag color="geekblue">{t}</Tag> : "—" },
          { title: "Recurrence", dataIndex: "recurrence_type", sorter: true, render: (_, s) => s.recurrence_type === "cron" ? <Tag>cron: {s.cron_expression}</Tag> : s.recurrence_type === "interval" ? <Tag>every {s.interval_seconds}s</Tag> : <Tag>once</Tag> },
          { title: "Next run", dataIndex: "next_run_at", sorter: true, render: (v) => v?.replace("T", " ").slice(0, 19) || "—" },
          { title: "Runs", dataIndex: "total_runs" },
          { title: "Enabled", dataIndex: "is_enabled", sorter: true, render: (_, s) => <div onClick={(e) => e.stopPropagation()}><Switch size="small" checked={s.is_enabled} onChange={() => toggle.mutate(s)} /></div> },
          { title: "", render: (_, s) => <Button size="small" danger type="text" onClick={(e) => { e.stopPropagation(); remove.mutate(s.id); }}>Delete</Button> },
        ]}
      />

      <Modal title="New schedule" open={open} onCancel={() => setOpen(false)} onOk={() => form.validateFields().then((v) => create.mutate(v))} confirmLoading={create.isPending}>
        <Form form={form} layout="vertical" initialValues={{ recurrence_type: "interval", interval_seconds: 300, is_enabled: true, timezone: "UTC" }}>
          <Form.Item name="test_definition_id" label="Test" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={tests.map((t) => ({ value: t.id, label: `${t.name} (${t.key})` }))} /></Form.Item>
          <Form.Item name="name" label="Name"><Input placeholder="optional" /></Form.Item>
          <Form.Item name="recurrence_type" label="Recurrence"><Select options={["interval", "cron", "once"].map((value) => ({ value }))} /></Form.Item>
          {rtype === "interval" && <Form.Item name="interval_seconds" label="Interval (seconds)" rules={[{ required: true }]}><InputNumber min={5} style={{ width: "100%" }} /></Form.Item>}
          {rtype === "cron" && <Form.Item name="cron_expression" label="Cron expression" rules={[{ required: true }]}><Input placeholder="*/5 * * * *" /></Form.Item>}
          <Form.Item name="timezone" label="Timezone"><Input /></Form.Item>
          <Form.Item name="is_enabled" label="Enabled" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
