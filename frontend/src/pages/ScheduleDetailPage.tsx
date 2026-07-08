import { Card, Descriptions, Typography, Space, Button, Table, Tag, Switch, App, Tabs } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
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

  const { data: s } = useQuery({ queryKey: ["schedule", id], queryFn: () => qtp.schedule(id) });
  const { data: runsPage } = useQuery({ queryKey: ["runs", "bySchedule", id], queryFn: () => qtp.runs(`?schedule_id=${id}`) });

  const toggle = useMutation({
    mutationFn: () => qtp.updateSchedule(id, { is_enabled: !s?.is_enabled }),
    onSuccess: () => {
      message.success("Schedule updated");
      qc.invalidateQueries({ queryKey: ["schedule", id] });
    }
  });

  if (!s) return null;

  const runs = runsPage || [];
  const chartData = runs.slice().reverse();
  const runChartOptions = {
    tooltip: { trigger: 'axis', formatter: (params: any) => { const p = params[0]; const data = chartData[p.dataIndex]; return `${data.queued_at?.replace("T", " ").slice(0, 19)}<br/>Status: ${data.status}<br/>Duration: ${data.duration_ms || 0} ms`; } },
    xAxis: { type: 'category', data: chartData.map((r: any) => ""), show: false },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } } },
    series: [{
      data: chartData.map((r: any) => ({ value: r.duration_ms || 0, itemStyle: { color: r.status === 'passed' ? '#52c41a' : (r.status === 'error' || r.status === 'failed' ? '#ff4d4f' : '#faad14') } })),
      type: 'bar', barMaxWidth: 20, itemStyle: { borderRadius: [2, 2, 0, 0] }
    }],
    grid: { left: 40, right: 10, top: 10, bottom: 0 },
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav("/schedules")}>Schedules</Button>
      </Space>

      <Typography.Title level={3}>
        {s.name} {s.is_enabled ? <Tag color="green">Active</Tag> : <Tag>Disabled</Tag>}
      </Typography.Title>
      
      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Toggle">
            <Switch size="small" checked={s.is_enabled} onChange={() => toggle.mutate()} />
          </Descriptions.Item>
          <Descriptions.Item label="Recurrence">
            {s.recurrence_type === "cron" ? <Tag>cron: {s.cron_expression}</Tag> : s.recurrence_type === "interval" ? <Tag>every {s.interval_seconds}s</Tag> : <Tag>once</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Next Run At">{s.next_run_at?.replace("T", " ").slice(0, 19) || "—"}</Descriptions.Item>

          <Descriptions.Item label="Target">
            {s.target_keys?.length
              ? s.target_keys.map((target: string) => <Tag key={target} color="geekblue">{target}</Tag>)
              : s.target_key ? <Tag color="geekblue">{s.target_key}</Tag> : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Environment">{s.environment}</Descriptions.Item>
          <Descriptions.Item label="Scenarios">
            {s.scenario_count || s.tests?.length || 1}
          </Descriptions.Item>
          
          <Descriptions.Item label="Total Runs">{s.total_runs}</Descriptions.Item>
          <Descriptions.Item label="Last Run Status">
            {s.last_run_status ? (
              <a onClick={() => s.last_run_id && nav(`/runs/${s.last_run_id}`)}>
                <StatusTag status={s.last_run_status} />
              </a>
            ) : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Created">{s.created_at?.replace("T", " ").slice(0, 19)}</Descriptions.Item>
        </Descriptions>
      </Card>

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
              {runs.length > 0 && (
                <div style={{ marginBottom: 16, padding: '16px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Execution Duration History</Typography.Text>
                  <ReactECharts option={runChartOptions} style={{ height: 120, width: '100%' }} />
                </div>
              )}
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
                  { title: "Queued", dataIndex: "queued_at", render: (v) => v?.replace("T", " ").slice(0, 19) },
                ]}
              />
            </div>
          )
        }
      ]} />
    </div>
  );
}
