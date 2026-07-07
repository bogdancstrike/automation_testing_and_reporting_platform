import { Button, Card, Col, Descriptions, Empty, Progress, Row, Space, Statistic, Table, Tag, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import { qtp } from "../api/qtp";
import { StatusTag, DefectTag, Duration } from "../components/tags";
import type { QueryParams } from "../api/types";

function sortOrder(order?: string) { return order === "ascend" ? "asc" : order === "descend" ? "desc" : undefined; }

export default function TargetDetailPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [testParams, setTestParams] = useState<QueryParams>({ page: 1, page_size: 10, sort: "name", order: "asc" });
  const [runParams, setRunParams] = useState<QueryParams>({ page: 1, page_size: 10, sort: "queued_at", order: "desc" });
  const { data: detail } = useQuery({ queryKey: ["targetDetail", id], queryFn: () => qtp.targetDetail(id), enabled: !!id });
  const { data: stats } = useQuery({ queryKey: ["targetStats", id], queryFn: () => qtp.targetStats(id), enabled: !!id, refetchInterval: 10000 });
  const { data: testsPage } = useQuery({ queryKey: ["targetTests", id, testParams], queryFn: () => qtp.targetTests(id, testParams), enabled: !!id });
  const { data: runsPage } = useQuery({ queryKey: ["targetRuns", id, runParams], queryFn: () => qtp.targetRuns(id, runParams), enabled: !!id, refetchInterval: 5000 });

  if (!detail) return null;
  const target = detail.target;
  const totals = detail.totals || {};
  const passPct = detail.pass_rate != null ? Math.round(detail.pass_rate * 100) : 0;
  const statuses = ["passed", "failed", "error", "timeout", "queued", "running"];
  const trend = stats?.trend || [];

  const trendOption = {
    tooltip: { trigger: "axis" }, legend: { data: statuses }, grid: { left: 36, right: 16, top: 32, bottom: 28 },
    xAxis: { type: "category", data: trend.map((t) => (t.bucket || "").slice(5, 16).replace("T", " ")) },
    yAxis: { type: "value" },
    series: statuses.map((s) => ({ name: s, type: "bar", stack: "runs", data: trend.map((t) => t[s] || 0) })),
  };
  const statusOption = {
    tooltip: { trigger: "item" },
    series: [{ type: "pie", radius: ["45%", "70%"], data: Object.entries(detail.status_distribution || {}).map(([name, value]) => ({ name, value })) }],
  };
  const durationOption = {
    tooltip: { trigger: "axis" }, grid: { left: 44, right: 16, top: 20, bottom: 28 },
    xAxis: { type: "category", data: (stats?.duration_trend || []).map((d) => d.bucket.slice(5, 16).replace("T", " ")) },
    yAxis: { type: "value" },
    series: [{ name: "avg ms", type: "line", smooth: true, showSymbol: false, data: (stats?.duration_trend || []).map((d) => d.avg_ms || 0) }],
  };

  return (
    <div>
      <Space style={{ marginBottom: 12 }}><Button icon={<ArrowLeftOutlined />} onClick={() => nav("/targets")}>Targets</Button></Space>
      <Space align="baseline" wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>{target.name}</Typography.Title>
        <Typography.Text code>{target.key}</Typography.Text>
        {(target.tags || []).map((tag) => <Tag key={tag}>{tag}</Tag>)}
      </Space>
      <Card size="small" style={{ marginTop: 12, marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Base URL"><Typography.Text code>{target.base_url}</Typography.Text></Descriptions.Item>
          <Descriptions.Item label="Health URL">{target.health_url ? <Typography.Text code>{target.health_url}</Typography.Text> : "—"}</Descriptions.Item>
          <Descriptions.Item label="Environment">{target.environment}</Descriptions.Item>
          <Descriptions.Item label="Pass ratio"><Progress percent={passPct} size="small" status={passPct >= 95 ? "success" : passPct >= 80 ? "active" : "exception"} /></Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Runs" value={totals.total_runs || 0} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Pass rate" value={detail.pass_rate != null ? detail.pass_rate * 100 : 0} precision={1} suffix="%" /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Failed" value={(totals.failed || 0) + (totals.error || 0) + (totals.timeout || 0)} valueStyle={{ color: "#cf1322" }} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Tests" value={detail.test_count || 0} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="p50" value={detail.duration_ms?.p50 || 0} suffix="ms" /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="p95" value={detail.duration_ms?.p95 || 0} suffix="ms" /></Card></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}><Card size="small" title="Run trend">{trend.length ? <ReactECharts option={trendOption} style={{ height: 280 }} /> : <Empty description="No runs" />}</Card></Col>
        <Col xs={24} lg={6}><Card size="small" title="Status distribution">{Object.keys(detail.status_distribution || {}).length ? <ReactECharts option={statusOption} style={{ height: 280 }} /> : <Empty description="No statuses" />}</Card></Col>
        <Col xs={24} lg={6}><Card size="small" title="Duration trend">{(stats?.duration_trend || []).length ? <ReactECharts option={durationOption} style={{ height: 280 }} /> : <Empty description="No durations" />}</Card></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={12}>
          <Card size="small" title="Tests for this target">
            <Table rowKey="id" size="small" dataSource={testsPage?.items || []}
              onRow={(r) => ({ onClick: () => nav(`/tests/${r.id}`), style: { cursor: "pointer" } })}
              pagination={{ current: testsPage?.page || 1, pageSize: testsPage?.page_size || 10, total: testsPage?.total || 0 }}
              onChange={(pagination, _filters, sorter: any) => setTestParams((p) => ({ ...p, page: pagination.current || 1, page_size: pagination.pageSize || 10, sort: sorter?.field || p.sort, order: sortOrder(sorter?.order) || p.order }))}
              columns={[
                { title: "Name", dataIndex: "name", sorter: true, render: (v) => <a>{v}</a> },
                { title: "Source", dataIndex: "source", sorter: true, render: (v) => <Tag>{v}</Tag> },
                { title: "Last", dataIndex: "last_run_status", sorter: true, render: (s) => <StatusTag status={s} /> },
                { title: "Tags", dataIndex: "tags", render: (tags) => (tags || []).map((t: string) => <Tag key={t}>{t}</Tag>) },
              ]} />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card size="small" title="Recent runs for this target">
            <Table rowKey="id" size="small" dataSource={runsPage?.items || []}
              onRow={(r) => ({ onClick: () => nav(`/runs/${r.id}`), style: { cursor: "pointer" } })}
              pagination={{ current: runsPage?.page || 1, pageSize: runsPage?.page_size || 10, total: runsPage?.total || 0 }}
              onChange={(pagination, _filters, sorter: any) => setRunParams((p) => ({ ...p, page: pagination.current || 1, page_size: pagination.pageSize || 10, sort: sorter?.field || p.sort, order: sortOrder(sorter?.order) || p.order }))}
              columns={[
                { title: "Test", dataIndex: "test_name" },
                { title: "Status", dataIndex: "status", sorter: true, render: (s) => <StatusTag status={s} /> },
                { title: "Duration", dataIndex: "duration_ms", sorter: true, render: (m) => <Duration ms={m} /> },
                { title: "Defect", dataIndex: "defect_type", sorter: true, render: (d) => <DefectTag defect={d} /> },
              ]} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
