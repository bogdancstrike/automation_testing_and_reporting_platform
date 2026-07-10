import { Table, Button, Typography, Space, App, Row, Col, Card, Statistic, Tag } from "antd";
import { ReloadOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { qtp } from "../api/qtp";
import { StatusTag, TypeTag } from "../components/tags";
import { antSortOrder, menuFilter, nextTableParams, textFilter } from "../components/remoteTable";
import type { QueryParams } from "../api/types";
import { formatLocalTime } from "../components/tags";
import { PageHeader } from "../components/PageHeader";

function displayDate(value?: string) { return value ? formatLocalTime(value) : "—"; }

export default function CatalogPage() {
  const { message } = App.useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useState<QueryParams>({ page: 1, page_size: 20, sort: "name", order: "asc" });
  const { data: page, isLoading } = useQuery({ queryKey: ["testsPage", params], queryFn: () => qtp.testsPage(params) });
  const tests = page?.items || [];
  const { data: targets = [] } = useQuery({ queryKey: ["targetsOptions"], queryFn: qtp.targets });

  const discover = useMutation({
    mutationFn: qtp.discover,
    onSuccess: (r) => { message.success(`Discovery: +${r.created} new, ${r.updated} updated, ${r.total_found} total`); qc.invalidateQueries({ queryKey: ["testsPage"] }); },
    onError: (e: any) => message.error(e.message || "discovery failed"),
  });
  const run = useMutation({
    mutationFn: (id: string) => qtp.runTest(id),
    onSuccess: (r) => { message.success("Run queued"); nav(`/runs/${r.id}`); },
    onError: (e: any) => message.error(e.message || "run failed"),
  });

  return (
    <div>
      <PageHeader
        title="Scenarios"
        subtitle={
          <>
            <strong style={{ color: "var(--qtp-text)" }}>{page?.total ?? 0}</strong> test definitions · backend-driven search, filters &amp; sorting
          </>
        }
        actions={
          <Button icon={<ReloadOutlined />} loading={discover.isPending} onClick={() => discover.mutate()}>Discover code scenarios</Button>
        }
      />

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={tests}
        onRow={(r) => ({ onClick: () => nav(`/scenarios/${r.id}`), style: { cursor: "pointer" } })}
        pagination={{ current: page?.page || 1, pageSize: page?.page_size || 20, total: page?.total || 0, showSizeChanger: true }}
        onChange={(pagination, filters, sorter: any, extra) => setParams((p) => nextTableParams(
          p,
          pagination,
          filters,
          sorter,
          extra,
          {
            name: "name",
            key: "key",
            type: "type",
            source: "source",
            target: "target",
            tag: "tag",
            created_at: "created_at",
            last_run_status: "last_run_status",
          },
          { sort: "name", order: "asc", pageSize: 20 },
        ))}
        columns={[
          { title: "Name", dataIndex: "name", sorter: true, sortOrder: antSortOrder(params, "name"), ...textFilter("name", params, "Search scenario name"), render: (v) => <a>{v}</a> },
          { title: "Key", dataIndex: "key", sorter: true, sortOrder: antSortOrder(params, "key"), ...textFilter("key", params, "Search scenario key"), render: (v) => <Typography.Text code>{v}</Typography.Text> },
          { title: "Type", dataIndex: "type", sorter: true, sortOrder: antSortOrder(params, "type"), ...menuFilter("type", params, ["http_request", "python_script", "playwright", "selenium", "cli"].map((value) => ({ text: value, value }))), render: (t) => <TypeTag type={t} /> },
          { title: "Source", dataIndex: "source", sorter: true, sortOrder: antSortOrder(params, "source"), ...menuFilter("source", params, [{ text: "code", value: "code" }, { text: "ui", value: "ui" }]), render: (s) => <Tag color={s === "code" ? "purple" : "cyan"}>{s}</Tag> },
          { title: "App", dataIndex: "target_key", sorter: true, sortOrder: antSortOrder(params, "target_key"), ...menuFilter("target", params, targets.map((t) => ({ text: t.key, value: t.key }))), render: (v) => <Tag color="geekblue">{v}</Tag> },
          { title: "Tags", dataIndex: "tags", sorter: true, sortOrder: antSortOrder(params, "tags"), ...textFilter("tag", params, "Search tag"), render: (tags) => (tags || []).map((x: string) => <Tag key={x}>{x}</Tag>) },
          { title: "Added at", dataIndex: "created_at", sorter: true, sortOrder: antSortOrder(params, "created_at"), ...textFilter("created_at", params, "YYYY-MM-DD"), render: displayDate },
          { title: "Last result", dataIndex: "last_run_status", sorter: true, sortOrder: antSortOrder(params, "last_run_status"), ...menuFilter("last_run_status", params, ["queued", "running", "passed", "failed", "error", "timeout", "canceled"].map((value) => ({ text: value, value }))), render: (s) => <StatusTag status={s} /> },
          { title: "Run", key: "run", width: 64, render: (_, r) => <Button size="small" type="text" icon={<PlayCircleOutlined />} onClick={(e) => { e.stopPropagation(); run.mutate(r.id); }} /> },
        ]}
      />
    </div>
  );
}
