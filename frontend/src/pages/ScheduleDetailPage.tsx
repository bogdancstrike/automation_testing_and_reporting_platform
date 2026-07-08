import { Card, Descriptions, Typography, Space, Button, Table, Tag, Switch, App, Tabs, Row, Col, Modal, Form, Select, Input, InputNumber } from "antd";
import { ArrowLeftOutlined, PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, ThunderboltOutlined, BlockOutlined, EditOutlined } from "@ant-design/icons";
import { useState } from "react";
import { StatCard } from "../components/StatCard";
import { formatDurationMs, formatLocalTime } from "../components/tags";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qtp } from "../api/qtp";
import { StatusTag } from "../components/tags";
import ReactECharts from "echarts-for-react";

export default function ScheduleDetailPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [openEdit, setOpenEdit] = useState(false);
  const [form] = Form.useForm();
  const rtype = Form.useWatch("recurrence_type", form);

  const { data: s } = useQuery({ queryKey: ["schedule", id], queryFn: () => qtp.schedule(id) });
  const { data: runsPage } = useQuery({ queryKey: ["runs", "bySchedule", id], queryFn: () => qtp.runs(`?schedule_id=${id}`) });
  const { data: testsPage } = useQuery({ queryKey: ["testsOptions"], queryFn: () => qtp.testsPage({ page_size: 100, sort: "name", order: "asc" }) });
  const testsOptions = testsPage?.items || [];

  const toggle = useMutation({
    mutationFn: () => qtp.updateSchedule(id, { is_enabled: !s?.is_enabled }),
    onSuccess: () => {
      message.success("Schedule updated");
      qc.invalidateQueries({ queryKey: ["schedule", id] });
    }
  });

  const update = useMutation({
    mutationFn: (v: any) => qtp.updateSchedule(id, v),
    onSuccess: () => { 
      message.success("Schedule updated"); 
      setOpenEdit(false); 
      qc.invalidateQueries({ queryKey: ["schedule", id] }); 
    },
    onError: (e: any) => message.error(e.message || "failed"),
  });

  const handleEdit = () => {
    form.setFieldsValue({
      name: s.name,
      recurrence_type: s.recurrence_type,
      interval_seconds: s.interval_seconds,
      cron_expression: s.cron_expression,
      timezone: s.timezone,
      is_enabled: s.is_enabled,
      test_definition_ids: (s.tests || []).filter((t: any) => !t.is_dynamic).map((t: any) => t.id),
      target_tags: s.target_tags || []
    });
    setOpenEdit(true);
  };

  if (!s) return null;

  const runs = runsPage || [];
  const chartData = runs.slice().reverse();
  const runChartOptions = {
    tooltip: { trigger: 'axis', formatter: (params: any) => { const p = params[0]; const data = chartData[p.dataIndex]; return `Scenario: ${data.test_name || data.test_definition_id}<br/>${formatLocalTime(data.queued_at)}<br/>Status: ${data.status}<br/>Duration: ${data.duration_ms || 0} ms`; } },
    xAxis: { type: 'category', data: chartData.map((r: any) => ""), show: false },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } } },
    series: [{
      data: chartData.map((r: any) => ({ value: r.duration_ms || 0, itemStyle: { color: r.status === 'passed' ? '#52c41a' : (r.status === 'error' || r.status === 'failed' ? '#ff4d4f' : r.status === 'running' ? '#2563eb' : '#faad14') } })),
      type: 'bar', barMaxWidth: 20, itemStyle: { borderRadius: [2, 2, 0, 0] }
    }],
    grid: { left: 40, right: 10, top: 10, bottom: 0 },
  };

  const totalRuns = runs.length;
  const passedCount = runs.filter((r: any) => r.status === 'passed').length;
  const failedCount = runs.filter((r: any) => ['failed', 'error', 'timeout'].includes(r.status)).length;
  const passRate = totalRuns > 0 ? (passedCount / totalRuns) * 100 : 0;
  const durations = runs.map((r: any) => r.duration_ms).filter((v: any) => v != null).sort((a: any, b: any) => a - b);
  const p50 = durations.length ? durations[Math.floor(durations.length * 0.5)] : 0;
  const p95 = durations.length ? durations[Math.floor(durations.length * 0.95)] : 0;

  const statusCounts = runs.reduce((acc: any, r: any) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const pieOptionStatus = {
    tooltip: { trigger: "item" }, legend: { bottom: 0 },
    series: [{
      type: "pie", radius: ["45%", "70%"], center: ["50%", "45%"],
      data: Object.entries(statusCounts).map(([k, v]) => ({ name: k, value: v as number, itemStyle: { color: k === 'passed' ? '#52c41a' : k === 'failed' ? '#ff4d4f' : k === 'error' ? '#fa541c' : k === 'running' ? '#2563eb' : '#faad14' } })),
    }],
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav("/schedules")}>Schedules</Button>
      </Space>

      <Typography.Title level={3}>
        {s.name} {s.is_enabled ? <Tag color="green">Active</Tag> : <Tag>Disabled</Tag>}
        <Button size="small" type="text" icon={<EditOutlined />} onClick={handleEdit} style={{ marginLeft: 8 }} />
      </Typography.Title>
      
      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="Toggle">
            <Switch size="small" checked={s.is_enabled} onChange={() => toggle.mutate()} />
          </Descriptions.Item>
          <Descriptions.Item label="Recurrence">
            {s.recurrence_type === "cron" ? <Tag>cron: {s.cron_expression}</Tag> : s.recurrence_type === "interval" ? <Tag>every {s.interval_seconds}s</Tag> : <Tag>once</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Next Run At">{formatLocalTime(s.next_run_at)}</Descriptions.Item>

          <Descriptions.Item label="Target">
            {s.target_keys?.length
              ? s.target_keys.map((target: string) => <Tag key={target} color="geekblue">{target}</Tag>)
              : s.target_key ? <Tag color="geekblue">{s.target_key}</Tag> : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Target Tags">
            {s.target_tags?.length ? s.target_tags.map((t: string) => <Tag key={t} color="purple">{t}</Tag>) : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Environment">{s.environment}</Descriptions.Item>
          <Descriptions.Item label="Scenarios">
            {s.tests?.length || s.scenario_count || 1}
            {(s.tests || []).some((t: any) => t.is_dynamic) && (
              <span style={{ marginLeft: 4, fontSize: 12, color: "#888" }}>(includes auto-tagged)</span>
            )}
          </Descriptions.Item>
          
          <Descriptions.Item label="Total Runs">{s.total_runs}</Descriptions.Item>
          <Descriptions.Item label="Last Run Status">
            {s.last_run_status ? (
              <a onClick={() => s.last_run_id && nav(`/runs/${s.last_run_id}`)}>
                <StatusTag status={s.last_run_status} />
              </a>
            ) : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Created">{formatLocalTime(s.created_at)}</Descriptions.Item>
        </Descriptions>
      </Card>

      {runs.length > 0 && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} md={6}><StatCard label="Total runs" value={totalRuns} icon={<PlayCircleOutlined />} accent="#2563eb" /></Col>
            <Col xs={12} md={6}><StatCard label="Pass rate" value={passRate} precision={1} suffix="%" icon={<CheckCircleOutlined />} accent="#16a34a" tintValue /></Col>
            <Col xs={12} md={6}><StatCard label="Failed" value={failedCount} icon={<CloseCircleOutlined />} accent="#dc2626" tintValue /></Col>
            <Col xs={12} md={6}><StatCard label="p95 duration" value={p95} icon={<ThunderboltOutlined />} accent="#d97706" formatter={(v) => formatDurationMs(Number(v))} /></Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} md={12}>
              <Card size="small" title="Status Distribution" bordered={false} style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <ReactECharts option={pieOptionStatus} style={{ height: 200 }} />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title="Execution Duration History" bordered={false} style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <ReactECharts option={runChartOptions} style={{ height: 200, width: '100%' }} />
              </Card>
            </Col>
          </Row>
        </>
      )}

      <Tabs items={[
        {
          key: "scenarios", 
          label: "Scheduled Scenarios",
          children: (
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={s.tests?.length ? s.tests : [{ id: s.test_definition_id, name: s.test_name, key: s.test_definition_id, target_key: s.target_key }]}
              onRow={(scenario: any) => ({ onClick: () => nav(`/scenarios/${scenario.id}`), style: { cursor: "pointer" } })}
              columns={[
                { title: "Name", dataIndex: "name", render: (value, scenario: any) => <a>{value || scenario.id}</a> },
                { title: "Key", dataIndex: "key", render: (value) => <Typography.Text code>{value || "—"}</Typography.Text> },
                { title: "Type", dataIndex: "type", render: (value) => value ? <Tag>{value}</Tag> : "—" },
                { title: "Target", dataIndex: "target_key", render: (value) => value ? <Tag color="geekblue">{value}</Tag> : "—" },
                { title: "Status", dataIndex: "status", render: (value) => value ? <Tag>{value}</Tag> : "—" },
              ]}
            />
          )
        },
        {
          key: "runs", 
          label: `Recent Runs (${runs.length})`,
          children: (
            <div>
              <Table
                rowKey="id"
                size="small"
                dataSource={runs}
                onRow={(r: any) => ({ onClick: () => nav(`/runs/${r.id}`), style: { cursor: "pointer" } })}
                columns={[
                  { title: "Scenario", dataIndex: "test_name", render: (n, r: any) => n || r.test_definition_id },
                  { title: "Status", dataIndex: "status", render: (st) => <StatusTag status={st} /> },
                  { title: "Duration", dataIndex: "duration_ms", render: (ms) => ms != null ? `${ms} ms` : "—" },
                  { title: "Defect", dataIndex: "defect_type", render: (d) => d || "—" },
                  { title: "Queued", dataIndex: "queued_at", render: (v) => formatLocalTime(v) },
                ]}
              />
            </div>
          )
        }
      ]} />

      <Modal title="Edit schedule" open={openEdit} onCancel={() => setOpenEdit(false)} onOk={() => form.validateFields().then((v) => update.mutate(v))} confirmLoading={update.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="test_definition_ids" label="Scenarios (Explicit)" rules={[{ required: false }]} tooltip="Explicitly select scenarios to include"><Select mode="multiple" showSearch optionFilterProp="label" options={testsOptions.map((t) => ({ value: t.id, label: `${t.name} (${t.key})` }))} allowClear /></Form.Item>
          <Form.Item name="target_tags" label="Scenarios by Tags" rules={[{ required: false }]} tooltip="Automatically include all scenarios matching ANY of these tags"><Select mode="tags" placeholder="e.g. #60mins, nightly" allowClear /></Form.Item>
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
