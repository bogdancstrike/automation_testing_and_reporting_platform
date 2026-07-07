import { Table, Typography, Space, Switch, Tag } from "antd";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { qtp } from "../api/qtp";
import { StatusTag, DefectTag, Duration } from "../components/tags";
import { antSortOrder, menuFilter, nextTableParams, textFilter } from "../components/remoteTable";
import type { QueryParams } from "../api/types";

export default function RunsPage() {
  const nav = useNavigate();
  const [live, setLive] = useState(true);
  const [params, setParams] = useState<QueryParams>({ page: 1, page_size: 20, sort: "queued_at", order: "desc" });
  const { data: page, isLoading } = useQuery({
    queryKey: ["runsPage", params],
    queryFn: () => qtp.runsPage(params),
    refetchInterval: live ? 3000 : false,
  });
  const { data: targets = [] } = useQuery({ queryKey: ["targetsOptions"], queryFn: qtp.targets });
  const { data: allTags = [] } = useQuery({ queryKey: ["allTags"], queryFn: () => qtp.tags("") });
  const runs = page?.items || [];

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Runs</Typography.Title>
          <Typography.Text type="secondary">Search, filters, sorting, and pagination are executed by the backend.</Typography.Text>
        </div>
        <Space><span>Live <Switch size="small" checked={live} onChange={setLive} /></span></Space>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={runs}
        onRow={(r) => ({ onClick: () => nav(`/runs/${r.id}`), style: { cursor: "pointer" } })}
        pagination={{ current: page?.page || 1, pageSize: page?.page_size || 20, total: page?.total || 0, showSizeChanger: true }}
        onChange={(pagination, filters, sorter: any, extra) => setParams((p) => nextTableParams(
          p,
          pagination,
          filters,
          sorter,
          extra,
          {
            test: "test",
            status: "status",
            trigger: "trigger",
            target: "target",
            tags: "tags",
            worker_name: "worker_name",
            duration_ms: "duration_ms",
            defect_type: "defect_type",
            error_category: "error_category",
            queued_at: "queued_at",
          },
          { sort: "queued_at", order: "desc", pageSize: 20 },
        ))}
        columns={[
          { title: "Scenario", dataIndex: "test_name", sorter: true, sortOrder: antSortOrder(params, "test_name"), ...textFilter("test", params, "Search scenario"), render: (v) => v || <em>—</em> },
          { title: "Status", dataIndex: "status", sorter: true, sortOrder: antSortOrder(params, "status"), ...menuFilter("status", params, ["queued", "running", "passed", "failed", "error", "timeout", "canceled"].map((value) => ({ text: value, value }))), render: (s) => <StatusTag status={s} /> },
          { title: "Trigger", dataIndex: "trigger", sorter: true, sortOrder: antSortOrder(params, "trigger"), ...menuFilter("trigger", params, ["manual", "schedule", "api", "discovery"].map((value) => ({ text: value, value }))) },
          { title: "Target", dataIndex: "target_key", sorter: true, sortOrder: antSortOrder(params, "target_key"), ...menuFilter("target", params, targets.map((t) => ({ text: t.key, value: t.key }))) },
          { title: "Tags", dataIndex: "tags", sorter: true, sortOrder: antSortOrder(params, "tags"), ...menuFilter("tags", params, allTags.map((tag: string) => ({ text: tag, value: tag })), true), render: (tags) => tags?.length ? <Space size={2} wrap>{tags.map((t: string) => <Tag key={t} style={{ margin: 0, padding: "0 4px", fontSize: 11 }}>{t}</Tag>)}</Space> : "—" },
          { title: "Worker", dataIndex: "worker_name", sorter: true, sortOrder: antSortOrder(params, "worker_name"), ...textFilter("worker_name", params, "Search worker"), render: (v) => v || "—" },
          { title: "Duration", dataIndex: "duration_ms", sorter: true, sortOrder: antSortOrder(params, "duration_ms"), ...textFilter("duration_ms", params, "Duration ms"), render: (m) => <Duration ms={m} /> },
          { title: "Defect", dataIndex: "defect_type", sorter: true, sortOrder: antSortOrder(params, "defect_type"), ...menuFilter("defect_type", params, ["product_bug", "automation_bug", "system_issue", "to_investigate", "no_defect"].map((value) => ({ text: value.replace(/_/g, " "), value }))), render: (d, r) => (["failed", "error", "timeout"].includes(r.status) ? <DefectTag defect={d} /> : null) },
          { title: "Category", dataIndex: "error_category", sorter: true, sortOrder: antSortOrder(params, "error_category"), ...textFilter("error_category", params, "Search category"), render: (v) => v || "—" },
          { title: "Queued", dataIndex: "queued_at", sorter: true, sortOrder: antSortOrder(params, "queued_at"), ...textFilter("queued_at", params, "YYYY-MM-DD"), render: (v) => v?.replace("T", " ").slice(0, 19) },
        ]}
      />
    </div>
  );
}
