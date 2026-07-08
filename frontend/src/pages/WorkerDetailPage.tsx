import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { qtp } from "../api/qtp";
import { Row, Col, Card, Typography, Space, Button, Tag, Badge, Table, Descriptions, Statistic } from "antd";
import { ArrowLeftOutlined, DesktopOutlined, PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, FieldTimeOutlined } from "@ant-design/icons";
import { StatusTag, formatDurationMs } from "../components/tags";
import { StatCard } from "../components/StatCard";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export default function WorkerDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const { data: workers = [] } = useQuery({ queryKey: ["workers"], queryFn: qtp.workers, refetchInterval: 10000 });
  const worker = workers.find((w: any) => w.name === id);

  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ["runs", "byWorker", id],
    queryFn: () => qtp.runs(`?worker_name=${id}&limit=100`),
    enabled: !!id
  });

  const totalRuns = runs.length;
  const passedCount = runs.filter((r: any) => r.status === 'passed').length;
  const failedCount = runs.filter((r: any) => ['failed', 'error', 'timeout'].includes(r.status)).length;
  const passRate = totalRuns > 0 ? (passedCount / totalRuns) * 100 : 0;
  
  const statusCounts = runs.reduce((acc: any, r: any) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  const pieOptionStatus = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, icon: "circle", itemWidth: 8 },
    series: [{
      type: 'pie', radius: ['40%', '70%'], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: Object.keys(statusCounts).map(k => ({ 
        name: k, 
        value: statusCounts[k], 
        itemStyle: { color: k === 'passed' ? '#52c41a' : (k === 'error' || k === 'failed' ? '#ff4d4f' : k === 'running' ? '#2563eb' : '#faad14') } 
      }))
    }]
  };

  const chartData = runs.slice().reverse();
  const runChartOptions = {
    tooltip: { trigger: 'axis', formatter: (params: any) => { const p = params[0]; const data = chartData[p.dataIndex]; return `${data.queued_at?.replace("T", " ").slice(0, 19)}<br/>Status: ${data.status}<br/>Duration: ${data.duration_ms || 0} ms`; } },
    xAxis: { type: 'category', data: chartData.map((r: any) => ""), show: false },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } } },
    series: [{
      data: chartData.map((r: any) => ({ value: r.duration_ms || 0, itemStyle: { color: r.status === 'passed' ? '#52c41a' : (r.status === 'error' || r.status === 'failed' ? '#ff4d4f' : r.status === 'running' ? '#2563eb' : '#faad14') } })),
      type: 'bar', barMaxWidth: 20, itemStyle: { borderRadius: [2, 2, 0, 0] }
    }],
    grid: { left: 40, right: 10, top: 10, bottom: 0 },
  };

  const isOffline = worker?.status === "offline";
  const isBusy = worker?.status === "busy";

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav("/workers")}>Workers</Button>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space align="center" style={{ marginBottom: 16 }}>
            <DesktopOutlined style={{ fontSize: 24, color: isOffline ? "#ccc" : "#1677ff" }} />
            <Typography.Title level={3} style={{ margin: 0 }}>{id}</Typography.Title>
            <Badge status={isOffline ? "default" : isBusy ? "processing" : "success"} text={worker?.status?.toUpperCase() || "UNKNOWN"} style={{ marginLeft: 8 }} />
          </Space>
          
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
            <Descriptions.Item label="Capabilities">
              {worker?.capabilities?.length ? worker.capabilities.map((c: string) => <Tag key={c} color="blue">{c}</Tag>) : <Typography.Text type="secondary" italic>generic</Typography.Text>}
            </Descriptions.Item>
            <Descriptions.Item label="Runs Completed">
              <Typography.Text strong>{worker?.runs_completed || 0}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Last Heartbeat">
              {worker?.last_heartbeat ? dayjs(worker.last_heartbeat).fromNow() : "never"}
            </Descriptions.Item>
          </Descriptions>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={8} lg={8}><StatCard label="Runs on this node" value={totalRuns} icon={<PlayCircleOutlined />} accent="#2563eb" /></Col>
        <Col xs={12} md={8} lg={8}><StatCard label="Pass rate" value={passRate} precision={1} suffix="%" icon={<CheckCircleOutlined />} accent="#16a34a" tintValue /></Col>
        <Col xs={12} md={8} lg={8}><StatCard label="Failed runs" value={failedCount} icon={<CloseCircleOutlined />} accent="#dc2626" tintValue /></Col>
      </Row>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card size="small" title="Status Distribution" bordered={false} style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <ReactECharts option={pieOptionStatus} style={{ height: 200 }} />
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card size="small" title="Execution Duration History" bordered={false} style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <ReactECharts option={runChartOptions} style={{ height: 200, width: '100%' }} />
          </Card>
        </Col>
      </Row>

      <Card size="small" title={`Recent Runs (${runs.length})`}>
        <Table rowKey="id" size="small" dataSource={runs} loading={runsLoading}
          onRow={(r) => ({ onClick: () => nav(`/runs/${r.id}`), style: { cursor: "pointer" } })}
          columns={[
            { title: "Status", dataIndex: "status", render: (s) => <StatusTag status={s} /> },
            { title: "Trigger", dataIndex: "trigger" },
            { title: "Env", dataIndex: "environment" },
            { title: "Queued", dataIndex: "queued_at", render: (d) => dayjs(d).fromNow() },
            { title: "Duration", dataIndex: "duration_ms", render: (v) => formatDurationMs(v) },
          ]}
          pagination={{ pageSize: 15 }} />
      </Card>
    </div>
  );
}
