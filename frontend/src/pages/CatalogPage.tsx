import { Table, Button, Typography, Space, Input, Select, App, Row, Col, Card, Statistic, Tag } from "antd";
import { ReloadOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { qtp } from "../api/qtp";
import { StatusTag, TypeTag } from "../components/tags";
import type { QueryParams } from "../api/types";

function sortOrder(order?: string) { return order === "ascend" ? "asc" : order === "descend" ? "desc" : undefined; }

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
      <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Test Catalog</Typography.Title>
          <Typography.Text type="secondary">Backend-driven search, filters, sorting, and pagination.</Typography.Text>
        </div>
        <Button icon={<ReloadOutlined />} loading={discover.isPending} onClick={() => discover.mutate()}>Discover code tests</Button>
      </Space>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Matching tests" value={page?.total || 0} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Current page" value={tests.length} /></Card></Col>
        <Col xs={24} md={12}><Card size="small"><Space wrap>{["http_request", "python_script", "playwright", "selenium", "cli"].map((k) => <Tag key={k}>{k}</Tag>)}</Space></Card></Col>
      </Row>

      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search placeholder="search name / key / owner" allowClear onSearch={(q) => setParams((p) => ({ ...p, q, page: 1 }))} style={{ width: 280 }} />
        <Select allowClear placeholder="type" style={{ width: 160 }} onChange={(type) => setParams((p) => ({ ...p, type, page: 1 }))}
          options={["http_request", "python_script", "playwright", "selenium", "cli"].map((value) => ({ value }))} />
        <Select allowClear placeholder="source" style={{ width: 130 }} onChange={(source) => setParams((p) => ({ ...p, source, page: 1 }))}
          options={[{ value: "code", label: "code" }, { value: "ui", label: "ui" }]} />
        <Select allowClear placeholder="target app" style={{ width: 180 }} onChange={(target) => setParams((p) => ({ ...p, target, page: 1 }))}
          options={targets.map((t) => ({ value: t.key, label: t.key }))} />
        <Input.Search placeholder="tag" allowClear onSearch={(tag) => setParams((p) => ({ ...p, tag, page: 1 }))} style={{ width: 180 }} />
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={tests}
        onRow={(r) => ({ onClick: () => nav(`/tests/${r.id}`), style: { cursor: "pointer" } })}
        pagination={{ current: page?.page || 1, pageSize: page?.page_size || 20, total: page?.total || 0, showSizeChanger: true }}
        onChange={(pagination, _filters, sorter: any) => setParams((p) => ({
          ...p, page: pagination.current || 1, page_size: pagination.pageSize || 20,
          sort: sorter?.field || p.sort, order: sortOrder(sorter?.order) || p.order,
        }))}
        columns={[
          { title: "Name", dataIndex: "name", sorter: true, render: (v) => <a>{v}</a> },
          { title: "Key", dataIndex: "key", sorter: true, render: (v) => <Typography.Text code>{v}</Typography.Text> },
          { title: "Type", dataIndex: "type", sorter: true, render: (t) => <TypeTag type={t} /> },
          { title: "Source", dataIndex: "source", sorter: true, render: (s) => <Tag color={s === "code" ? "purple" : "cyan"}>{s}</Tag> },
          { title: "App", dataIndex: "target_key", sorter: true, render: (v) => <Tag color="geekblue">{v}</Tag> },
          { title: "Tags", dataIndex: "tags", render: (tags) => (tags || []).map((x: string) => <Tag key={x}>{x}</Tag>) },
          { title: "Last result", dataIndex: "last_run_status", sorter: true, render: (s) => <StatusTag status={s} /> },
          { title: "Run", key: "run", width: 64, render: (_, r) => <Button size="small" type="text" icon={<PlayCircleOutlined />} onClick={(e) => { e.stopPropagation(); run.mutate(r.id); }} /> },
        ]}
      />
    </div>
  );
}
