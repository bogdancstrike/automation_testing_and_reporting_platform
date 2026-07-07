import { Table, Typography, Select, Space, Switch } from "antd";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { qtp } from "../api/qtp";
import { StatusTag, DefectTag, Duration } from "../components/tags";

export default function RunsPage() {
  const nav = useNavigate();
  const [status, setStatus] = useState<string>();
  const [live, setLive] = useState(true);
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["runs", status],
    queryFn: () => qtp.runs(status ? `?status=${status}` : ""),
    refetchInterval: live ? 3000 : false,
  });

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Runs</Typography.Title>
        <Space>
          <Select allowClear placeholder="status" style={{ width: 150 }} onChange={setStatus}
            options={["queued", "running", "passed", "failed", "error", "timeout", "canceled"].map((v) => ({ value: v }))} />
          <span>Live <Switch size="small" checked={live} onChange={setLive} /></span>
        </Space>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={runs}
        onRow={(r) => ({ onClick: () => nav(`/runs/${r.id}`), style: { cursor: "pointer" } })}
        columns={[
          { title: "Test", dataIndex: "test_name", render: (v) => v || <em>—</em> },
          { title: "Status", dataIndex: "status", render: (s) => <StatusTag status={s} /> },
          { title: "Trigger", dataIndex: "trigger" },
          { title: "Target", dataIndex: "target_key" },
          { title: "Worker", dataIndex: "worker_name", render: (v) => v || "—" },
          { title: "Duration", dataIndex: "duration_ms", render: (m) => <Duration ms={m} /> },
          { title: "Defect", dataIndex: "defect_type", render: (d, r) => (["failed", "error", "timeout"].includes(r.status) ? <DefectTag defect={d} /> : null) },
          { title: "Queued", dataIndex: "queued_at", render: (v) => v?.replace("T", " ").slice(0, 19) },
        ]}
      />
    </div>
  );
}
