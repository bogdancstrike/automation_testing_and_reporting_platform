import { useState } from "react";
import { Row, Col, Card, Typography, Table, Empty, Progress, Radio, DatePicker, Space } from "antd";
import {
  PlayCircleOutlined, CheckCircleOutlined, InboxOutlined, ClusterOutlined,
  CloseCircleOutlined, WarningOutlined, FieldTimeOutlined, ThunderboltOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import { qtp } from "../api/qtp";
import { StatusTag, DefectTag, formatDurationMs } from "../components/tags";
import { StatCard } from "../components/StatCard";
import { apiSortOrder, menuFilter, textFilter } from "../components/remoteTable";
import type { QueryParams } from "../api/types";
import { useNavigate } from "react-router-dom";
import { formatLocalTime } from "../components/tags";

const { RangePicker } = DatePicker;

function prefixedSortOrder(params: QueryParams, prefix: string, field: string) {
  if (params[`${prefix}_sort`] !== field) return null;
  return params[`${prefix}_order`] === "asc" ? "ascend" : "descend";
}

function nextDashboardTableParams(
  prev: QueryParams,
  filters: Record<string, any>,
  sorter: any,
  prefix: string,
  filterMap: Record<string, string>,
  defaults: { sort: string; order: "asc" | "desc" },
): QueryParams {
  const order = apiSortOrder(sorter?.order);
  const next: QueryParams = {
    ...prev,
    [`${prefix}_sort`]: order ? (sorter?.field || sorter?.columnKey || defaults.sort) : defaults.sort,
    [`${prefix}_order`]: order || defaults.order,
  };
  Object.entries(filterMap).forEach(([tableKey, paramKey]) => {
    const values = filters?.[tableKey];
    next[paramKey] = values && values.length ? values.map(String).join(",") : undefined;
  });
  return next;
}

export default function OverviewPage() {
  const nav = useNavigate();
  const [timeRange, setTimeRange] = useState("24h");
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [targetTableParams, setTargetTableParams] = useState<QueryParams>({ per_target_sort: "total", per_target_order: "desc" });
  const [failureTableParams, setFailureTableParams] = useState<QueryParams>({ recent_failed_sort: "finished_at", recent_failed_order: "desc" });

  const getQueryParams = () => {
    if (timeRange === "custom" && customRange) {
      return { start_time: customRange[0].toISOString(), end_time: customRange[1].toISOString() };
    }
    const hours = timeRange === "1h" ? 1 : timeRange === "24h" ? 24 : timeRange === "7d" ? 168 : 720;
    return { hours };
  };

  const params = getQueryParams();
  const overviewParams = { ...params, ...targetTableParams };
  const failureParams = { ...params, ...failureTableParams };
  const { data: ov } = useQuery({ queryKey: ["overview", timeRange, customRange, targetTableParams], queryFn: () => qtp.overview(overviewParams), refetchInterval: 5000 });
  const { data: fail } = useQuery({ queryKey: ["failures", timeRange, customRange, failureTableParams], queryFn: () => qtp.failures(failureParams), refetchInterval: 8000 });

  const totals = ov?.totals || {};
  const trend = ov?.trend || [];
  const statuses = ["passed", "failed", "error", "timeout", "running"];
  const colors: Record<string, string> = { passed: "#52c41a", failed: "#ff4d4f", error: "#fa541c", timeout: "#faad14", running: "#2563eb" };

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
        <Col xs={12} md={6}><StatCard label="Total runs" value={totals.total_runs || 0} icon={<PlayCircleOutlined />} accent="#2563eb" onClick={() => nav("/runs")} /></Col>
        <Col xs={12} md={6}><StatCard label="Pass rate" value={ov?.pass_rate != null ? ov.pass_rate * 100 : 0} precision={1} suffix="%" icon={<CheckCircleOutlined />} accent="#16a34a" tintValue onClick={() => nav("/runs?status=passed")} /></Col>
        <Col xs={12} md={6}><StatCard label="Queue backlog" value={ov?.queue_backlog || 0} icon={<InboxOutlined />} accent="#0891b2" onClick={() => nav("/runs?status=queued")} /></Col>
        <Col xs={12} md={6}><StatCard label="Running" value={totals.running || 0} icon={<LoadingOutlined spin />} accent="#2563eb" tintValue onClick={() => nav("/runs?status=running")} /></Col>
        <Col xs={12} md={6}><StatCard label="Active workers" value={ov?.active_workers || 0} icon={<ClusterOutlined />} accent="#7c3aed" onClick={() => nav("/workers")} /></Col>
        <Col xs={12} md={6}><StatCard label="Failed" value={totals.failed || 0} icon={<CloseCircleOutlined />} accent="#dc2626" tintValue onClick={() => nav("/runs?status=failed")} /></Col>
        <Col xs={12} md={6}><StatCard label="Errors" value={totals.error || 0} icon={<WarningOutlined />} accent="#ea580c" tintValue onClick={() => nav("/runs?status=error")} /></Col>
        <Col xs={12} md={6}><StatCard label="p50 duration" value={ov?.duration_ms?.p50 || 0} icon={<FieldTimeOutlined />} accent="#0891b2" formatter={(v) => formatDurationMs(Number(v))} onClick={() => nav("/runs?sort=duration_ms&order=desc")} /></Col>
        <Col xs={12} md={6}><StatCard label="p95 duration" value={ov?.duration_ms?.p95 || 0} icon={<ThunderboltOutlined />} accent="#d97706" formatter={(v) => formatDurationMs(Number(v))} onClick={() => nav("/runs?sort=duration_ms&order=desc")} /></Col>
        <Col xs={12} md={6}><StatCard label="Cleanup Fails" value={ov?.cleanup_failures || 0} icon={<WarningOutlined />} accent="#cf1322" tintValue onClick={() => nav("/runs?cleanup_failed=failed")} /></Col>
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
              onChange={(_, filters, sorter: any) => setTargetTableParams((p) => nextDashboardTableParams(
                p,
                filters,
                sorter,
                "per_target",
                { per_target_q: "per_target_q", per_target_health: "per_target_health" },
                { sort: "total", order: "desc" },
              ))}
              columns={[
                { title: "Target", dataIndex: "target_key", sorter: true, sortOrder: prefixedSortOrder(targetTableParams, "per_target", "target_key"), ...textFilter("per_target_q", targetTableParams, "Search target") },
                { title: "Runs", dataIndex: "total", width: 80, sorter: true, sortOrder: prefixedSortOrder(targetTableParams, "per_target", "total") },
                { title: "Passed", dataIndex: "passed", width: 86, sorter: true, sortOrder: prefixedSortOrder(targetTableParams, "per_target", "passed") },
                { title: "Failed", dataIndex: "failed", width: 86, sorter: true, sortOrder: prefixedSortOrder(targetTableParams, "per_target", "failed") },
                {
                  title: "Health", dataIndex: "health_rate", sorter: true, sortOrder: prefixedSortOrder(targetTableParams, "per_target", "health_rate"), ...menuFilter("per_target_health", targetTableParams, [{ text: "healthy", value: "healthy" }, { text: "degraded", value: "degraded" }]), render: (_: any, r: any) => {
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
              onChange={(_, filters, sorter: any) => setFailureTableParams((p) => nextDashboardTableParams(
                p,
                filters,
                sorter,
                "recent_failed",
                {
                  recent_failed_q: "recent_failed_q",
                  recent_failed_status: "recent_failed_status",
                  recent_failed_error_category: "recent_failed_error_category",
                  recent_failed_defect_type: "recent_failed_defect_type",
                  recent_failed_finished_at: "recent_failed_finished_at",
                },
                { sort: "finished_at", order: "desc" },
              ))}
              columns={[
                { title: "Scenario", dataIndex: "test_name", sorter: true, sortOrder: prefixedSortOrder(failureTableParams, "recent_failed", "test_name"), ...textFilter("recent_failed_q", failureTableParams, "Search scenario") },
                { title: "Status", dataIndex: "status", sorter: true, sortOrder: prefixedSortOrder(failureTableParams, "recent_failed", "status"), ...menuFilter("recent_failed_status", failureTableParams, ["failed", "error", "timeout"].map((value) => ({ text: value, value }))), render: (s) => <StatusTag status={s} /> },
                { title: "Category", dataIndex: "error_category", sorter: true, sortOrder: prefixedSortOrder(failureTableParams, "recent_failed", "error_category"), ...textFilter("recent_failed_error_category", failureTableParams, "Search category") },
                { title: "Defect", dataIndex: "defect_type", sorter: true, sortOrder: prefixedSortOrder(failureTableParams, "recent_failed", "defect_type"), ...menuFilter("recent_failed_defect_type", failureTableParams, ["product_bug", "automation_bug", "system_issue", "to_investigate", "no_defect"].map((value) => ({ text: value.replace(/_/g, " "), value }))), render: (d) => <DefectTag defect={d} /> },
                { title: "Time", dataIndex: "finished_at", sorter: true, sortOrder: prefixedSortOrder(failureTableParams, "recent_failed", "finished_at"), ...textFilter("recent_failed_finished_at", failureTableParams, "YYYY-MM-DD"), render: (v) => formatLocalTime(v) }
              ]}
              locale={{ emptyText: <Empty description="No failures 🎉" /> }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
