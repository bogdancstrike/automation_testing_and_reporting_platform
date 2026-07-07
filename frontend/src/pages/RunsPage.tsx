import { Table, Typography, Select, Space, Switch, Input, Tag } from "antd";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { qtp } from "../api/qtp";
import { StatusTag, DefectTag, Duration } from "../components/tags";
import type { QueryParams } from "../api/types";

function sortOrder(order?: string) { return order === "ascend" ? "asc" : order === "descend" ? "desc" : undefined; }

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
      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search placeholder="search test / target / worker" allowClear onSearch={(q) => setParams((p) => ({ ...p, q, page: 1 }))} style={{ width: 280 }} />
        <Select allowClear placeholder="status" style={{ width: 150 }} onChange={(status) => setParams((p) => ({ ...p, status, page: 1 }))}
          options={["queued", "running", "passed", "failed", "error", "timeout", "canceled"].map((value) => ({ value }))} />
        <Select allowClear placeholder="trigger" style={{ width: 150 }} onChange={(trigger) => setParams((p) => ({ ...p, trigger, page: 1 }))}
          options={["manual", "schedule", "api", "discovery"].map((value) => ({ value }))} />
        <Select allowClear placeholder="target" style={{ width: 170 }} onChange={(target) => setParams((p) => ({ ...p, target, page: 1 }))}
          options={targets.map((t) => ({ value: t.key, label: t.key }))} />
        <Select allowClear placeholder="defect" style={{ width: 180 }} onChange={(defect_type) => setParams((p) => ({ ...p, defect_type, page: 1 }))}
          options={["product_bug", "automation_bug", "system_issue", "to_investigate", "no_defect"].map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
        <Select mode="tags" allowClear placeholder="tags" style={{ width: 180 }} onChange={(tags) => setParams((p) => ({ ...p, tags: tags.join(","), page: 1 }))}
          options={allTags.map((tag: string) => ({ value: tag, label: tag }))} />
        <Input.Search placeholder="failure category" allowClear onSearch={(error_category) => setParams((p) => ({ ...p, error_category, page: 1 }))} style={{ width: 190 }} />
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={runs}
        onRow={(r) => ({ onClick: () => nav(`/runs/${r.id}`), style: { cursor: "pointer" } })}
        pagination={{ current: page?.page || 1, pageSize: page?.page_size || 20, total: page?.total || 0, showSizeChanger: true }}
        onChange={(pagination, _filters, sorter: any) => setParams((p) => ({
          ...p, page: pagination.current || 1, page_size: pagination.pageSize || 20,
          sort: sorter?.field || p.sort, order: sortOrder(sorter?.order) || p.order,
        }))}
        columns={[
          { title: "Test", dataIndex: "test_name", render: (v) => v || <em>—</em> },
          { title: "Status", dataIndex: "status", sorter: true, render: (s) => <StatusTag status={s} /> },
          { title: "Trigger", dataIndex: "trigger", sorter: true },
          { title: "Target", dataIndex: "target_key" },
          { title: "Tags", dataIndex: "tags", render: (tags) => tags?.length ? <Space size={2} wrap>{tags.map((t: string) => <Tag key={t} style={{ margin: 0, padding: "0 4px", fontSize: 11 }}>{t}</Tag>)}</Space> : "—" },
          { title: "Worker", dataIndex: "worker_name", sorter: true, render: (v) => v || "—" },
          { title: "Duration", dataIndex: "duration_ms", sorter: true, render: (m) => <Duration ms={m} /> },
          { title: "Defect", dataIndex: "defect_type", sorter: true, render: (d, r) => (["failed", "error", "timeout"].includes(r.status) ? <DefectTag defect={d} /> : null) },
          { title: "Queued", dataIndex: "queued_at", sorter: true, render: (v) => v?.replace("T", " ").slice(0, 19) },
        ]}
      />
    </div>
  );
}
