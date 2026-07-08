import { Table, Typography, Space, Switch, Tag, Button, App, Dropdown } from "antd";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { qtp } from "../api/qtp";
import { StatusTag, DefectTag, Duration } from "../components/tags";
import { antSortOrder, menuFilter, nextTableParams, textFilter } from "../components/remoteTable";
import type { QueryParams } from "../api/types";
import { formatLocalTime } from "../components/tags";

export default function RunsPage() {
  const nav = useNavigate();
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const [live, setLive] = useState(true);
  const [searchParams] = useSearchParams();
  // Seed initial filters/sort from the URL so Overview stat cards can deep-link
  // (e.g. /runs?status=failed, /runs?cleanup_failed=failed, /runs?sort=duration_ms&order=desc).
  const [params, setParams] = useState<QueryParams>(() => {
    const seed: QueryParams = { page: 1, page_size: 20, sort: "queued_at", order: "desc" };
    for (const key of ["status", "cleanup_failed", "trigger", "target", "defect_type"]) {
      const v = searchParams.get(key);
      if (v) seed[key] = v;
    }
    const sort = searchParams.get("sort");
    if (sort) { seed.sort = sort; seed.order = searchParams.get("order") === "asc" ? "asc" : "desc"; }
    return seed;
  });
  const { data: page, isLoading } = useQuery({
    queryKey: ["runsPage", params],
    queryFn: () => qtp.runsPage(params),
    refetchInterval: live ? 2000 : false,
  });
  const { data: targets = [] } = useQuery({ queryKey: ["targetsOptions"], queryFn: qtp.targets });
  const { data: allTags = [] } = useQuery({ queryKey: ["allTags"], queryFn: () => qtp.tags("") });
  const { data: overview } = useQuery({
    queryKey: ["overview", 24],
    queryFn: () => qtp.overview({ hours: 24 }),
    refetchInterval: live ? 5000 : false,
  });
  const runs = page?.items || [];

  const rerunQueued = useMutation({
    mutationFn: () => qtp.rerunQueuedRuns(),
    onSuccess: (data: any) => {
      message.success(`Re-queued ${data.requeued_count} runs`);
      qc.invalidateQueries({ queryKey: ["runsPage"] });
    },
    onError: (e: any) => message.error(e.message),
  });

  const restartFailed = useMutation({
    mutationFn: () => qtp.restartFailedRuns(),
    onSuccess: (data: any) => {
      message.success(`Restarted ${data.restarted_count} failed runs`);
      qc.invalidateQueries({ queryKey: ["runsPage"] });
    },
    onError: (e: any) => message.error(e.message),
  });

  const deleteRun = useMutation({
    mutationFn: (id: string) => qtp.deleteRun(id),
    onSuccess: () => {
      message.success("Run deleted");
      qc.invalidateQueries({ queryKey: ["runsPage"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (e: any) => message.error(e.message),
  });

  const deleteAllRuns = useMutation({
    mutationFn: () => qtp.deleteAllRuns(),
    onSuccess: (data: any) => {
      message.success(`Deleted ${data.count} runs`);
      qc.invalidateQueries({ queryKey: ["runsPage"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (e: any) => message.error(e.message),
  });

  const rerunRun = useMutation({
    mutationFn: (id: string) => qtp.rerunRun(id),
    onSuccess: () => {
      message.success("Run restarted");
      qc.invalidateQueries({ queryKey: ["runsPage"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (e: any) => message.error(e.message),
  });

  const confirmDeleteRun = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    modal.confirm({
      title: "Delete Run",
      content: "Are you sure you want to delete this run?",
      okText: "Yes",
      okType: "danger",
      cancelText: "No",
      onOk: () => {
        modal.confirm({
          title: "Final Confirmation",
          content: "This action is irreversible. Are you absolutely sure you want to delete this run?",
          okText: "Delete",
          okType: "danger",
          cancelText: "Cancel",
          onOk: () => deleteRun.mutate(id),
        });
      },
    });
  };

  const confirmDeleteAll = () => {
    modal.confirm({
      title: "Delete ALL Runs",
      content: "Are you sure you want to delete ALL runs across ALL targets?",
      okText: "Yes",
      okType: "danger",
      cancelText: "No",
      onOk: () => {
        modal.confirm({
          title: "DANGER: Final Confirmation",
          content: "This will permanently delete EVERY run, log, and step history in the database. Are you absolutely sure?",
          okText: "Delete ALL",
          okType: "danger",
          cancelText: "Cancel",
          onOk: () => deleteAllRuns.mutate(),
        });
      },
    });
  };

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Runs</Typography.Title>
          <Typography.Text type="secondary">Search, filters, sorting, and pagination are executed by the backend.</Typography.Text>
        </div>
        <Space>
          <Button danger onClick={confirmDeleteAll} loading={deleteAllRuns.isPending}>Delete All Runs</Button>
          <Button onClick={() => rerunQueued.mutate()} loading={rerunQueued.isPending}>Re-run all queued</Button>
          <Button onClick={() => restartFailed.mutate()} loading={restartFailed.isPending}>Re-run all failed/errors</Button>
          <span>Live <Switch size="small" checked={live} onChange={setLive} /></span>
        </Space>
      </Space>
      {overview && (
        <Space size="large" style={{ marginBottom: 16, padding: "8px 16px", background: "var(--qtp-surface-bg)", borderRadius: 4, border: "1px solid var(--qtp-surface-border)", width: "100%" }}>
          <Typography.Link onClick={() => setParams(p => ({ ...p, status: undefined, page: 1 }))}>
            <Typography.Text>Total runs (24h): <strong>{overview.totals.total_runs}</strong></Typography.Text>
          </Typography.Link>
          <Typography.Link onClick={() => setParams(p => ({ ...p, status: "queued", page: 1 }))}>
            <Typography.Text>Queued: <strong>{overview.totals.queued}</strong></Typography.Text>
          </Typography.Link>
          <Typography.Link onClick={() => setParams(p => ({ ...p, status: "running", page: 1 }))}>
            <Typography.Text>Running: <strong style={{ color: "#2563eb" }}>{overview.totals.running}</strong></Typography.Text>
          </Typography.Link>
          <Typography.Link onClick={() => setParams(p => ({ ...p, status: "passed", page: 1 }))}>
            <Typography.Text>Passed: <strong style={{ color: "#52c41a" }}>{overview.totals.passed}</strong></Typography.Text>
          </Typography.Link>
          <Typography.Link onClick={() => setParams(p => ({ ...p, status: "failed", page: 1 }))}>
            <Typography.Text>Failed: <strong style={{ color: "#f5222d" }}>{overview.totals.failed}</strong></Typography.Text>
          </Typography.Link>
          <Typography.Link onClick={() => setParams(p => ({ ...p, status: "error", page: 1 }))}>
            <Typography.Text>Errors: <strong style={{ color: "#f5222d" }}>{overview.totals.error}</strong></Typography.Text>
          </Typography.Link>
        </Space>
      )}
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
            cleanup_failed: "cleanup_failed",
          },
          { sort: "queued_at", order: "desc", pageSize: 20 },
        ))}
        columns={[
          { title: "Scenario", dataIndex: "test_name", sorter: true, sortOrder: antSortOrder(params, "test_name"), ...textFilter("test", params, "Search scenario"), render: (v) => v || <em>—</em> },
          {
            title: "Status",
            dataIndex: "status",
            sorter: true,
            sortOrder: antSortOrder(params, "status"),
            ...menuFilter("status", params, ["queued", "running", "passed", "failed", "error", "timeout", "canceled"].map((value) => ({ text: value, value }))),
            render: (s) => <StatusTag status={s} />
          },
          {
            title: "Cleanup",
            dataIndex: "cleanup_failed",
            sorter: true,
            sortOrder: antSortOrder(params, "cleanup_failed"),
            ...menuFilter("cleanup_failed", params, [{ text: "passed", value: "passed" }, { text: "failed", value: "failed" }]),
            render: (cf, r) => (
              <Tag color={cf ? "error" : "success"} title={cf ? r.cleanup_error || "Cleanup failed" : undefined} style={{ margin: 0 }}>
                {cf ? "failed" : "passed"}
              </Tag>
            ),
          },
          { title: "Trigger", dataIndex: "trigger", sorter: true, sortOrder: antSortOrder(params, "trigger"), ...menuFilter("trigger", params, ["manual", "schedule", "api", "discovery"].map((value) => ({ text: value, value }))) },
          { title: "Target", dataIndex: "target_key", sorter: true, sortOrder: antSortOrder(params, "target_key"), ...menuFilter("target", params, targets.map((t) => ({ text: t.key, value: t.key }))) },
          { title: "Tags", dataIndex: "tags", sorter: true, sortOrder: antSortOrder(params, "tags"), ...menuFilter("tags", params, allTags.map((tag: string) => ({ text: tag, value: tag })), true), render: (tags) => tags?.length ? <Space size={2} wrap>{tags.map((t: string) => <Tag key={t} style={{ margin: 0, padding: "0 4px", fontSize: 11 }}>{t}</Tag>)}</Space> : "—" },
          { title: "Worker", dataIndex: "worker_name", sorter: true, sortOrder: antSortOrder(params, "worker_name"), ...textFilter("worker_name", params, "Search worker"), render: (v) => v || "—" },
          { title: "Duration", dataIndex: "duration_ms", sorter: true, sortOrder: antSortOrder(params, "duration_ms"), ...textFilter("duration_ms", params, "Duration ms"), render: (m) => <Duration ms={m} /> },
          { title: "Defect", dataIndex: "defect_type", sorter: true, sortOrder: antSortOrder(params, "defect_type"), ...menuFilter("defect_type", params, ["product_bug", "automation_bug", "system_issue", "to_investigate", "no_defect"].map((value) => ({ text: value.replace(/_/g, " "), value }))), render: (d, r) => (["failed", "error", "timeout"].includes(r.status) ? <DefectTag defect={d} /> : null) },
          { title: "Category", dataIndex: "error_category", sorter: true, sortOrder: antSortOrder(params, "error_category"), ...textFilter("error_category", params, "Search category"), render: (v) => v || "—" },
          { title: "Queued", dataIndex: "queued_at", sorter: true, sortOrder: antSortOrder(params, "queued_at"), ...textFilter("queued_at", params, "YYYY-MM-DD"), render: (v) => formatLocalTime(v) },
          { 
            title: "Actions", 
            key: "actions", 
            render: (_, r) => (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'run',
                      label: 'Run',
                      onClick: (e) => {
                        e.domEvent.stopPropagation();
                        rerunRun.mutate(r.id);
                      }
                    },
                    {
                      key: 'delete',
                      danger: true,
                      label: 'Delete',
                      onClick: (e) => {
                        e.domEvent.stopPropagation();
                        confirmDeleteRun(e.domEvent as any, r.id);
                      }
                    }
                  ]
                }}
                trigger={['click']}
              >
                <Button size="small" type="text" onClick={(e) => e.stopPropagation()} style={{ padding: '0 8px' }}>
                  <Typography.Text style={{ fontSize: 18, lineHeight: 1 }}>⋯</Typography.Text>
                </Button>
              </Dropdown>
            )
          },
        ]}
      />
    </div>
  );
}
