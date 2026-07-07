import { Table, Button, Typography, Space, Input, Select, App } from "antd";
import { ReloadOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { qtp } from "../api/qtp";
import { StatusTag, TypeTag } from "../components/tags";

export default function CatalogPage() {
  const { message } = App.useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [type, setType] = useState<string>();
  const [search, setSearch] = useState("");

  const { data: tests = [], isLoading } = useQuery({ queryKey: ["tests"], queryFn: () => qtp.tests() });

  const discover = useMutation({
    mutationFn: qtp.discover,
    onSuccess: (r) => { message.success(`Discovery: +${r.created} new, ${r.updated} updated`); qc.invalidateQueries({ queryKey: ["tests"] }); },
    onError: (e: any) => message.error(e.message || "discovery failed"),
  });
  const run = useMutation({
    mutationFn: (id: string) => qtp.runTest(id),
    onSuccess: (r) => { message.success("Run queued"); nav(`/runs/${r.id}`); },
    onError: (e: any) => message.error(e.message || "run failed"),
  });

  const filtered = tests.filter((t) =>
    (!type || t.type === type) &&
    (!search || t.name.toLowerCase().includes(search.toLowerCase()) || t.key.toLowerCase().includes(search.toLowerCase())));

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Test Catalog</Typography.Title>
        <Button icon={<ReloadOutlined />} loading={discover.isPending} onClick={() => discover.mutate()}>
          Discover code tests
        </Button>
      </Space>
      <Space style={{ marginBottom: 12 }}>
        <Input.Search placeholder="search name / key" allowClear onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} />
        <Select allowClear placeholder="type" style={{ width: 160 }} onChange={setType}
          options={["http_request", "python_script", "playwright", "selenium", "cli"].map((v) => ({ value: v, label: v }))} />
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={filtered}
        onRow={(r) => ({ onClick: () => nav(`/tests/${r.id}`), style: { cursor: "pointer" } })}
        columns={[
          { title: "Name", dataIndex: "name", render: (v, r) => <a>{v}</a> },
          { title: "Key", dataIndex: "key", render: (v) => <Typography.Text code>{v}</Typography.Text> },
          { title: "Type", dataIndex: "type", render: (t) => <TypeTag type={t} /> },
          { title: "Source", dataIndex: "source" },
          { title: "Target", dataIndex: "target_key" },
          { title: "Last result", dataIndex: "last_run_status", render: (s) => <StatusTag status={s} /> },
          {
            title: "", key: "run", width: 60,
            render: (_, r) => (
              <Button size="small" type="text" icon={<PlayCircleOutlined />}
                onClick={(e) => { e.stopPropagation(); run.mutate(r.id); }} />
            ),
          },
        ]}
      />
    </div>
  );
}
