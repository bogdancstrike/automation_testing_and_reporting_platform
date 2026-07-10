import { formatLocalTime } from "../components/tags";
import { PageHeader } from "../components/PageHeader";
import { Table, Typography, Button, Space, Modal, Form, Select, Input, InputNumber, Switch, App, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { qtp } from "../api/qtp";
import { antSortOrder, menuFilter, nextTableParams, textFilter } from "../components/remoteTable";
import type { QueryParams } from "../api/types";

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
  const { data: targets = [] } = useQuery({ queryKey: ["targetsOptions"], queryFn: qtp.targets });
  const { data: allTags = [] } = useQuery({ queryKey: ["allTags"], queryFn: () => qtp.tags("") });
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
      <PageHeader
        title="Schedules"
        subtitle="Automated run triggers and cadences"
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>New schedule</Button>}
      />
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={page?.items || []}
        onRow={(r: any) => ({ onClick: () => nav(`/schedules/${r.id}`), style: { cursor: "pointer" } })}
        pagination={{ current: page?.page || 1, pageSize: page?.page_size || 20, total: page?.total || 0, showSizeChanger: true }}
        onChange={(pagination, filters, sorter: any, extra) => setParams((p) => nextTableParams(
          p,
          pagination,
          filters,
          sorter,
          extra,
          {
            name: "name",
            scenario: "scenario",
            target: "target",
            recurrence_type: "recurrence_type",
            next_run_at: "next_run_at",
            is_enabled: "is_enabled",
          },
          { sort: "created_at", order: "desc", pageSize: 20 },
        ))}
        columns={[
          { title: "Name", dataIndex: "name", sorter: true, sortOrder: antSortOrder(params, "name"), ...textFilter("name", params, "Search schedule") },
          {
            title: "Scenarios",
            dataIndex: "scenario_count",
            sorter: true,
            sortOrder: antSortOrder(params, "scenario_count"),
            ...textFilter("scenario", params, "Search scenario"),
            render: (_: any, s: any) => {
              const tests = s.tests || [];
              const tags = s.target_tags || [];
              if (!tests.length && !tags.length) return "—";
              return (
                <Space size={[4, 4]} wrap direction="vertical">
                  {tags.length > 0 && (
                    <Space size={[4, 4]} wrap>
                      {tags.map((t: string) => <Tag key={t} color="purple">{t}</Tag>)}
                    </Space>
                  )}
                  {tests.length > 0 && (
                    <Space size={[4, 4]} wrap>
                      {tests.slice(0, 3).map((t: any) => <Tag key={t.id}>{t.name}</Tag>)}
                      {tests.length > 3 && <Tag>+{tests.length - 3}</Tag>}
                    </Space>
                  )}
                </Space>
              );
            },
          },
          {
            title: "Targets",
            dataIndex: "target_keys",
            ...menuFilter("target", params, targets.map((t) => ({ text: t.key, value: t.key }))),
            render: (_: any, s: any) => {
              const keys = s.target_keys?.length ? s.target_keys : (s.target_key ? [s.target_key] : []);
              return keys.length ? keys.map((t: string) => <Tag key={t} color="geekblue">{t}</Tag>) : "—";
            },
          },
          { title: "Recurrence", dataIndex: "recurrence_type", sorter: true, sortOrder: antSortOrder(params, "recurrence_type"), ...menuFilter("recurrence_type", params, ["interval", "cron", "once"].map((value) => ({ text: value, value }))), render: (_, s) => s.recurrence_type === "cron" ? <Tag>cron: {s.cron_expression}</Tag> : s.recurrence_type === "interval" ? <Tag>every {s.interval_seconds}s</Tag> : <Tag>once</Tag> },
          { title: "Next run", dataIndex: "next_run_at", sorter: true, sortOrder: antSortOrder(params, "next_run_at"), ...textFilter("next_run_at", params, "YYYY-MM-DD"), render: (v) => formatLocalTime(v) || "—" },
          { title: "Runs", dataIndex: "total_runs" },
          { title: "Enabled", dataIndex: "is_enabled", sorter: true, sortOrder: antSortOrder(params, "is_enabled"), ...menuFilter("is_enabled", params, [{ text: "enabled", value: "true" }, { text: "disabled", value: "false" }]), render: (_, s) => <div onClick={(e) => e.stopPropagation()}><Switch size="small" checked={s.is_enabled} onChange={() => toggle.mutate(s)} /></div> },
          { title: "Actions", render: (_, s) => <Button size="small" danger type="text" onClick={(e) => { e.stopPropagation(); remove.mutate(s.id); }}>Delete</Button> },
        ]}
      />

      <Modal title="New schedule" open={open} onCancel={() => setOpen(false)} onOk={() => form.validateFields().then((v) => create.mutate(v))} confirmLoading={create.isPending}>
        <Form form={form} layout="vertical" initialValues={{ recurrence_type: "interval", interval_seconds: 300, is_enabled: true, timezone: "UTC" }}>
          <Form.Item name="scenario_ids" label="Scenarios (Explicit)" rules={[{ required: false }]} tooltip="Explicitly select scenarios to include"><Select mode="multiple" showSearch optionFilterProp="label" options={tests.map((t) => ({ value: t.id, label: `${t.name} (${t.key})` }))} allowClear /></Form.Item>
          <Form.Item name="target_tags" label="Scenarios by Tags" rules={[{ required: false }]} tooltip="Automatically include all scenarios matching ANY of these tags"><Select mode="tags" placeholder="e.g. #60mins, nightly" allowClear options={allTags.map((tag: string) => ({ value: tag, label: tag }))} /></Form.Item>
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
