import { Table, Button, Typography, Space, Input, Select, App, Row, Col, Card, Statistic, Tag } from "antd";
import { ReloadOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { qtp } from "../api/qtp";
import { StatusTag, TypeTag } from "../components/tags";

export default function CatalogPage() {
  const { message } = App.useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [type, setType] = useState<string>();
  const [source, setSource] = useState<string>();
  const [targetKey, setTargetKey] = useState<string>();
  const [search, setSearch] = useState("");

  const { data: tests = [], isLoading } = useQuery({ queryKey: ["tests"], queryFn: () => qtp.tests() });
  const { data: targets = [] } = useQuery({ queryKey: ["targets"], queryFn: qtp.targets });

  const discover = useMutation({
    mutationFn: qtp.discover,
    onSuccess: (r) => { message.success(`Discovery: +${r.created} new, ${r.updated} updated, ${r.total_found} total`); qc.invalidateQueries({ queryKey: ["tests"] }); },
    onError: (e: any) => message.error(e.message || "discovery failed"),
  });
  const run = useMutation({
    mutationFn: (id: string) => qtp.runTest(id),
    onSuccess: (r) => { message.success("Run queued"); nav(`/runs/${r.id}`); },
    onError: (e: any) => message.error(e.message || "run failed"),
  });

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    let passing = 0, failing = 0, code = 0, ui = 0;
    for (const t of tests) {
      byType[t.type] = (byType[t.type] || 0) + 1;
      if (t.last_run_status === "passed") passing++;
      if (["failed", "error", "timeout"].includes(t.last_run_status || "")) failing++;
      if (t.source === "code") code++; else ui++;
    }
    return { total: tests.length, byType, passing, failing, code, ui };
  }, [tests]);

  const filtered = tests.filter((t) =>
    (!type || t.type === type) &&
    (!source || t.source === source) &&
    (!targetKey || t.target_key === targetKey) &&
    (!search || t.name.toLowerCase().includes(search.toLowerCase()) || t.key.toLowerCase().includes(search.toLowerCase())));

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Test Catalog</Typography.Title>
        <Button icon={<ReloadOutlined />} loading={discover.isPending} onClick={() => discover.mutate()}>
          Discover code tests
        </Button>
      </Space>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Total tests" value={stats.total} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Code / UI" value={`${stats.code} / ${stats.ui}`} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Passing" value={stats.passing} valueStyle={{ color: "#52c41a" }} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Failing" value={stats.failing} valueStyle={{ color: "#ff4d4f" }} /></Card></Col>
        <Col xs={24} md={8}><Card size="small"><Space wrap>{Object.entries(stats.byType).map(([k, v]) => <Tag key={k}>{k}: {v}</Tag>)}</Space></Card></Col>
      </Row>

      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search placeholder="search name / key" allowClear onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} />
        <Select allowClear placeholder="type" style={{ width: 150 }} onChange={setType}
          options={Object.keys(stats.byType).map((v) => ({ value: v, label: v }))} />
        <Select allowClear placeholder="source" style={{ width: 130 }} onChange={setSource}
          options={[{ value: "code", label: "code" }, { value: "ui", label: "ui" }]} />
        <Select allowClear placeholder="target app" style={{ width: 170 }} onChange={setTargetKey}
          options={targets.map((t) => ({ value: t.key, label: t.key }))} />
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={filtered}
        onRow={(r) => ({ onClick: () => nav(`/tests/${r.id}`), style: { cursor: "pointer" } })}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        columns={[
          { title: "Name", dataIndex: "name", render: (v) => <a>{v}</a>, sorter: (a, b) => a.name.localeCompare(b.name) },
          { title: "Key", dataIndex: "key", render: (v) => <Typography.Text code>{v}</Typography.Text> },
          { title: "Type", dataIndex: "type", render: (t) => <TypeTag type={t} /> },
          { title: "Source", dataIndex: "source", render: (s) => <Tag color={s === "code" ? "purple" : "cyan"}>{s}</Tag> },
          { title: "App (target)", dataIndex: "target_key", render: (v) => <Tag color="geekblue">{v}</Tag> },
          { title: "Owner", dataIndex: "owner", render: (v) => v || "—" },
          { title: "Last result", dataIndex: "last_run_status", render: (s) => <StatusTag status={s} /> },
          {
            title: "Run", key: "run", width: 60,
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
