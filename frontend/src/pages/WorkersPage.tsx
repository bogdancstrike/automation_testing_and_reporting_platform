import { Row, Col, Card, Typography, Tag, Space, Badge, Statistic, Empty, Skeleton } from "antd";
import { DesktopOutlined, NodeIndexOutlined, FieldTimeOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { qtp } from "../api/qtp";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export default function WorkersPage() {
  const { data: workers = [], isLoading } = useQuery({ queryKey: ["workers"], queryFn: qtp.workers, refetchInterval: 4000 });

  const activeWorkers = workers.filter((w: any) => w.status !== "offline").length;
  const totalRuns = workers.reduce((acc: number, w: any) => acc + (w.runs_completed || 0), 0);

  return (
    <div>
      <Space style={{ marginBottom: 24, justifyContent: "space-between", width: "100%" }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Workers Cluster</Typography.Title>
          <Typography.Text type="secondary">Monitor your active test execution nodes and agent fleets.</Typography.Text>
        </div>
        <Space size="large">
          <Statistic title="Active Nodes" value={activeWorkers} suffix={`/ ${workers.length}`} />
          <Statistic title="Total Runs Processed" value={totalRuns} />
        </Space>
      </Space>

      {isLoading ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3].map(i => <Col xs={24} md={12} lg={8} key={i}><Card><Skeleton active /></Card></Col>)}
        </Row>
      ) : workers.length === 0 ? (
        <Empty description="No workers connected. Start a worker node to begin executing tests." />
      ) : (
        <Row gutter={[16, 16]}>
          {workers.map((w: any) => {
            const isOffline = w.status === "offline";
            const isBusy = w.status === "busy";
            return (
              <Col xs={24} md={12} lg={8} key={w.name}>
                <Card 
                  size="small" 
                  title={
                    <Space>
                      <DesktopOutlined style={{ color: isOffline ? "#ccc" : "#1677ff" }} />
                      <Typography.Text strong>{w.name}</Typography.Text>
                    </Space>
                  }
                  extra={
                    <Badge status={isOffline ? "default" : isBusy ? "processing" : "success"} text={w.status.toUpperCase()} />
                  }
                  style={{ opacity: isOffline ? 0.7 : 1, borderColor: isBusy ? "#1677ff" : undefined }}
                >
                  <Space direction="vertical" style={{ width: "100%" }} size="middle">
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>CAPABILITIES</Typography.Text>
                      {w.capabilities && w.capabilities.length > 0 ? (
                        w.capabilities.map((c: string) => <Tag key={c} color="blue">{c}</Tag>)
                      ) : <Typography.Text type="secondary" italic>generic</Typography.Text>}
                    </div>

                    <Row>
                      <Col span={12}>
                        <Statistic title="Runs Completed" value={w.runs_completed} valueStyle={{ fontSize: 18 }} prefix={<CheckCircleOutlined />} />
                      </Col>
                      <Col span={12}>
                        <Typography.Text type="secondary" style={{ fontSize: 12, display: "block" }}>CURRENT RUN</Typography.Text>
                        {w.current_run_id ? (
                          <Link to={`/runs/${w.current_run_id}`}>
                            <Tag icon={<NodeIndexOutlined />} color="processing">{w.current_run_id.slice(0, 8)}</Tag>
                          </Link>
                        ) : <Typography.Text type="secondary">—</Typography.Text>}
                      </Col>
                    </Row>
                    
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
                      <Space>
                        <FieldTimeOutlined style={{ color: "#aaa" }} />
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Heartbeat: {w.last_heartbeat ? dayjs(w.last_heartbeat).fromNow() : "never"}</Typography.Text>
                      </Space>
                    </div>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
