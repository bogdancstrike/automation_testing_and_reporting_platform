import { Table, Typography, Button, Space, Modal, Form, Select, Input, InputNumber, Switch, App, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qtp } from "../api/qtp";

export default function SchedulesPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const rtype = Form.useWatch("recurrence_type", form);

  const { data: schedules = [], isLoading } = useQuery({ queryKey: ["schedules"], queryFn: qtp.schedules });
  const { data: tests = [] } = useQuery({ queryKey: ["tests"], queryFn: () => qtp.tests() });

  const create = useMutation({
    mutationFn: (v: any) => qtp.createSchedule(v),
    onSuccess: () => { message.success("Schedule created"); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ["schedules"] }); },
    onError: (e: any) => message.error(e.message || "failed"),
  });
  const toggle = useMutation({
    mutationFn: (s: any) => qtp.updateSchedule(s.id, { is_enabled: !s.is_enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => qtp.deleteSchedule(id),
    onSuccess: () => { message.success("Deleted"); qc.invalidateQueries({ queryKey: ["schedules"] }); },
  });

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Schedules</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>New schedule</Button>
      </Space>
      <Table rowKey="id" loading={isLoading} dataSource={schedules}
        columns={[
          { title: "Name", dataIndex: "name" },
          { title: "Test", dataIndex: "test_name" },
          { title: "Recurrence", render: (_, s) => s.recurrence_type === "cron" ? <Tag>cron: {s.cron_expression}</Tag> : s.recurrence_type === "interval" ? <Tag>every {s.interval_seconds}s</Tag> : <Tag>once</Tag> },
          { title: "Next run", dataIndex: "next_run_at", render: (v) => v?.replace("T", " ").slice(0, 19) || "—" },
          { title: "Enabled", render: (_, s) => <Switch size="small" checked={s.is_enabled} onChange={() => toggle.mutate(s)} /> },
          { title: "", render: (_, s) => <Button size="small" danger type="text" onClick={() => remove.mutate(s.id)}>Delete</Button> },
        ]} />

      <Modal title="New schedule" open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => create.mutate(v))} confirmLoading={create.isPending}>
        <Form form={form} layout="vertical" initialValues={{ recurrence_type: "interval", interval_seconds: 300, is_enabled: true, timezone: "UTC" }}>
          <Form.Item name="test_definition_id" label="Test" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={tests.map((t) => ({ value: t.id, label: `${t.name} (${t.key})` }))} />
          </Form.Item>
          <Form.Item name="name" label="Name"><Input placeholder="optional" /></Form.Item>
          <Form.Item name="recurrence_type" label="Recurrence">
            <Select options={["interval", "cron", "once"].map((v) => ({ value: v }))} />
          </Form.Item>
          {rtype === "interval" && <Form.Item name="interval_seconds" label="Interval (seconds)" rules={[{ required: true }]}><InputNumber min={5} style={{ width: "100%" }} /></Form.Item>}
          {rtype === "cron" && <Form.Item name="cron_expression" label="Cron expression" rules={[{ required: true }]}><Input placeholder="*/5 * * * *" /></Form.Item>}
          <Form.Item name="timezone" label="Timezone"><Input /></Form.Item>
          <Form.Item name="is_enabled" label="Enabled" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
