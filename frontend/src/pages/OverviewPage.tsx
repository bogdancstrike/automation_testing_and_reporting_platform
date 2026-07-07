import { Row, Col, Card, Statistic, Typography, Table, Empty, Progress } from "antd";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import { qtp } from "../api/qtp";
import { StatusTag, DefectTag } from "../components/tags";

export default function OverviewPage() {
  const { data: ov } = useQuery({ queryKey: ["overview"], queryFn: () => qtp.overview(24), refetchInterval: 5000 });
  const { data: fail } = useQuery({ queryKey: ["failures"], queryFn: () => qtp.failures(168), refetchInterval: 8000 });

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
      data: Object.entries(defectDist).map(([k, v]) => ({ name: k, value: v })),
    }],
  };

  return (
    <div>
      <Typography.Title level={3}>Operational Overview <Typography.Text type="secondary" style={{ fontSize: 14 }}>· last 24h</Typography.Text></Typography.Title>
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
          <Card title="Run trend" size="small">
            {trend.length ? <ReactECharts option={trendOption} style={{ height: 280 }} /> : <Empty description="No runs yet" />}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Defect distribution (7d)" size="small">
            {Object.keys(defectDist).length ? <ReactECharts option={pieOption} style={{ height: 280 }} /> : <Empty description="No failures" />}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Per-target health (24h)" size="small">
            <Table
              rowKey={(r: any) => r.target_key || "?"}
              size="small"
              pagination={false}
              dataSource={ov?.per_target || []}
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
        <Col xs={24} lg={12}>
          <Card title="Recent failures" size="small">
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={fail?.recent_failed || []}
              columns={[
                { title: "Test", dataIndex: "test_name" },
                { title: "Status", dataIndex: "status", render: (s) => <StatusTag status={s} /> },
                { title: "Category", dataIndex: "error_category" },
                { title: "Defect", dataIndex: "defect_type", render: (d) => <DefectTag defect={d} /> },
              ]}
              locale={{ emptyText: <Empty description="No failures 🎉" /> }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
