import { useState } from "react";
import { Row, Col, Card, Statistic, Typography, Table, Empty, Progress, Radio, DatePicker, Space } from "antd";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import { qtp } from "../api/qtp";
import { StatusTag, DefectTag } from "../components/tags";
import { useNavigate } from "react-router-dom";

const { RangePicker } = DatePicker;

export default function OverviewPage() {
  const nav = useNavigate();
  const [timeRange, setTimeRange] = useState("24h");
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const getQueryParams = () => {
    if (timeRange === "custom" && customRange) {
      return { start_time: customRange[0].toISOString(), end_time: customRange[1].toISOString() };
    }
    const hours = timeRange === "1h" ? 1 : timeRange === "24h" ? 24 : timeRange === "7d" ? 168 : 720;
    return { hours };
  };

  const params = getQueryParams();
  const { data: ov } = useQuery({ queryKey: ["overview", timeRange, customRange], queryFn: () => qtp.overview(params), refetchInterval: 5000 });
  const { data: fail } = useQuery({ queryKey: ["failures", timeRange, customRange], queryFn: () => qtp.failures(params), refetchInterval: 8000 });

  const totals = ov?.totals || {};
  const trend = ov?.trend || [];
  const statuses = ["passed", "failed", "error", "timeout"];
  const colors: Record<string, string> = { passed: "#52c41a", failed: "#ff4d4f", error: "#fa541c", timeout: "#faad14" };

  const trendOption = {
    tooltip: { trigger: "axis" },
    legend: { data: statuses },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: { type: "category", data: trend.map((t) => (t.bucket || "").slice(11, 16)) },
    yAxis: { type: "value" },
    series: statuses.map((s) => ({
      name: s, type: "line", stack: "total", areaStyle: {}, showSymbol: false,
      itemStyle: { color: colors[s] }, data: trend.map((t) => t[s] || 0),
    })),
  };

  const defectDist = fail?.defect_distribution || {};
  const pieOption = {
    tooltip: { trigger: "item" },
    series: [{
      type: "pie", radius: ["45%", "70%"],
      data: Object.entries(defectDist).map(([k, v]) => ({ name: k, value: v as number })),
    }],
  };

  const perTarget = ov?.per_target || [];
  const targetBarOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { data: ["passed", "failed"] },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: { type: "value" },
    yAxis: { type: "category", data: perTarget.map(t => t.target_key || "unknown") },
    series: [
      { name: "passed", type: "bar", stack: "total", itemStyle: { color: colors.passed }, data: perTarget.map(t => t.passed || 0) },
      { name: "failed", type: "bar", stack: "total", itemStyle: { color: colors.failed }, data: perTarget.map(t => t.failed || 0) }
    ]
  };

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Operational Overview
        </Typography.Title>
        <Space wrap>
          <Radio.Group value={timeRange} onChange={e => setTimeRange(e.target.value)} buttonStyle="solid">
            <Radio.Button value="1h">Last 1h</Radio.Button>
            <Radio.Button value="24h">Last 24h</Radio.Button>
            <Radio.Button value="7d">Last 7d</Radio.Button>
            <Radio.Button value="30d">Last 30d</Radio.Button>
            <Radio.Button value="custom">Custom</Radio.Button>
          </Radio.Group>
          {timeRange === "custom" && (
            <RangePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              value={customRange as any}
              onChange={(dates) => setCustomRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
            />
          )}
        </Space>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}><Card className="qtp-kpi"><Statistic title="Total runs" value={totals.total_runs || 0} /></Card></Col>
        <Col xs={12} md={6}><Card className="qtp-kpi"><Statistic title="Pass rate" value={ov?.pass_rate != null ? ov.pass_rate * 100 : 0} precision={1} suffix="%" valueStyle={{ color: "#52c41a" }} /></Card></Col>
        <Col xs={12} md={6}><Card className="qtp-kpi"><Statistic title="Queue backlog" value={ov?.queue_backlog || 0} /></Card></Col>
        <Col xs={12} md={6}><Card className="qtp-kpi"><Statistic title="Active workers" value={ov?.active_workers || 0} /></Card></Col>
        <Col xs={12} md={6}><Card className="qtp-kpi"><Statistic title="Failed" value={totals.failed || 0} valueStyle={{ color: "#ff4d4f" }} /></Card></Col>
        <Col xs={12} md={6}><Card className="qtp-kpi"><Statistic title="Errors" value={totals.error || 0} valueStyle={{ color: "#fa541c" }} /></Card></Col>
        <Col xs={12} md={6}><Card className="qtp-kpi"><Statistic title="p50 duration" value={ov?.duration_ms?.p50 || 0} suffix="ms" /></Card></Col>
        <Col xs={12} md={6}><Card className="qtp-kpi"><Statistic title="p95 duration" value={ov?.duration_ms?.p95 || 0} suffix="ms" /></Card></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="Run execution trend" size="small">
            {trend.length ? <ReactECharts option={trendOption} style={{ height: 280 }} /> : <Empty description="No runs yet" />}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Defect distribution" size="small">
            {Object.keys(defectDist).length ? <ReactECharts option={pieOption} style={{ height: 280 }} /> : <Empty description="No failures" />}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Runs by target" size="small">
            {perTarget.length ? <ReactECharts option={targetBarOption} style={{ height: 280 }} /> : <Empty description="No target runs" />}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Per-target health breakdown" size="small">
            <Table
              rowKey={(r: any) => r.target_key || "?"}
              size="small"
              pagination={{ pageSize: 5 }}
              dataSource={perTarget}
              columns={[
                { title: "Target", dataIndex: "target_key" },
                { title: "Runs", dataIndex: "total", width: 80 },
                {
                  title: "Health", render: (_: any, r: any) => {
                    const pct = r.total ? Math.round((r.passed / r.total) * 100) : 0;
                    return <Progress percent={pct} size="small" status={pct < 100 ? "active" : "success"} />;
                  },
                },
              ]}
              locale={{ emptyText: <Empty description="No target runs" /> }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="Recent failures" size="small">
            <Table
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5 }}
              dataSource={fail?.recent_failed || []}
              onRow={(r: any) => ({ onClick: () => nav(`/runs/${r.id}`), style: { cursor: "pointer" } })}
              columns={[
                { title: "Test", dataIndex: "test_name" },
                { title: "Status", dataIndex: "status", render: (s) => <StatusTag status={s} /> },
                { title: "Category", dataIndex: "error_category" },
                { title: "Defect", dataIndex: "defect_type", render: (d) => <DefectTag defect={d} /> },
                { title: "Time", dataIndex: "finished_at", render: (v) => v?.replace("T", " ").slice(0, 19) }
              ]}
              locale={{ emptyText: <Empty description="No failures 🎉" /> }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
