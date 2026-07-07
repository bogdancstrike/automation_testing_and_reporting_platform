import { Table, Typography, Tag } from "antd";
import { useQuery } from "@tanstack/react-query";
import { qtp } from "../api/qtp";

export default function WorkersPage() {
  const { data: workers = [], isLoading } = useQuery({ queryKey: ["workers"], queryFn: qtp.workers, refetchInterval: 4000 });
  return (
    <div>
      <Typography.Title level={3}>Workers</Typography.Title>
      <Table rowKey="name" loading={isLoading} dataSource={workers}
        columns={[
          { title: "Name", dataIndex: "name" },
          { title: "Status", dataIndex: "status", render: (s) => <Tag color={s === "busy" ? "processing" : s === "offline" ? "default" : "success"}>{s}</Tag> },
          { title: "Capabilities", dataIndex: "capabilities", render: (c) => (c || []).map((x: string) => <Tag key={x}>{x}</Tag>) },
          { title: "Runs completed", dataIndex: "runs_completed" },
          { title: "Current run", dataIndex: "current_run_id", render: (v) => v ? <Typography.Text code>{v.slice(0, 8)}</Typography.Text> : "—" },
          { title: "Last heartbeat", dataIndex: "last_heartbeat", render: (v) => v?.replace("T", " ").slice(0, 19) },
        ]} />
    </div>
  );
}
