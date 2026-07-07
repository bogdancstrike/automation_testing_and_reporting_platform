import { Table, Typography, Button, Space, Modal, Form, Input, App, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qtp } from "../api/qtp";

export default function TargetsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const { data: targets = [], isLoading } = useQuery({ queryKey: ["targets"], queryFn: qtp.targets });

  const create = useMutation({
    mutationFn: (v: any) => qtp.createTarget({ ...v, tags: v.tags ? v.tags.split(",").map((s: string) => s.trim()) : [] }),
    onSuccess: () => { message.success("Target created"); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ["targets"] }); },
    onError: (e: any) => message.error(e.message || "failed"),
  });

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Targets</Typography.Title>
          <Typography.Text type="secondary">Applications under test — addressed by URL. Tests reference a target instead of hard-coding a URL.</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>New target</Button>
      </Space>
      <Table rowKey="id" loading={isLoading} dataSource={targets}
        columns={[
          { title: "Key", dataIndex: "key", render: (v) => <Typography.Text code>{v}</Typography.Text> },
          { title: "Name", dataIndex: "name" },
          { title: "Base URL", dataIndex: "base_url" },
          { title: "Environment", dataIndex: "environment" },
          { title: "Tags", dataIndex: "tags", render: (t) => (t || []).map((x: string) => <Tag key={x}>{x}</Tag>) },
        ]} />

      <Modal title="New target" open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => create.mutate(v))} confirmLoading={create.isPending}>
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
