import React from "react";
import { Table, Typography, Space, Tooltip } from "antd";

interface Timings {
  dns?: number;
  ttfb?: number;
  download?: number;
  method?: string;
  url?: string;
  status_code?: number;
  is_network?: boolean;
}

interface Step {
  id?: string;
  name: string;
  status: string;
  duration_ms: number;
  timings?: Timings;
  error?: string;
}

const PayloadView = ({ payload, details }: { payload?: any, details?: any }) => {
  if (details) {
    return (
      <div style={{ background: "#f8fafc", padding: 12, borderRadius: 4, margin: "8px 0" }}>
        <Typography.Text strong>Event Details</Typography.Text>
        <pre style={{ fontSize: 11, marginTop: 8, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(details, null, 2)}
        </pre>
      </div>
    );
  }
  if (!payload) return null;
  return (
    <div style={{ background: "#f8fafc", padding: 12, borderRadius: 4, margin: "8px 0", display: "flex", gap: 24 }}>
      <div style={{ flex: 1 }}>
        <Typography.Text strong>Request</Typography.Text>
        <pre style={{ fontSize: 11, marginTop: 8, maxHeight: 200, overflow: "auto" }}>
          {JSON.stringify(payload.request_headers || {}, null, 2)}
          {"\n\n"}
          {payload.request_body || "(no body)"}
        </pre>
      </div>
      <div style={{ flex: 1 }}>
        <Typography.Text strong>Response</Typography.Text>
        <pre style={{ fontSize: 11, marginTop: 8, maxHeight: 200, overflow: "auto" }}>
          {JSON.stringify(payload.response_headers || {}, null, 2)}
          {"\n\n"}
          {payload.response_body || "(no body)"}
        </pre>
      </div>
    </div>
  );
};

interface WaterfallChartProps {
  steps: Step[];
}

export default function WaterfallChart({ steps }: WaterfallChartProps) {
  // Find the total duration across all steps to calculate percentages
  const maxDuration = steps.reduce((max, step) => Math.max(max, step.duration_ms), 100);
  
  const networkSteps = steps.filter(s => s.timings?.is_network);
  const totalSize = networkSteps.reduce((acc, s) => acc + (s.timings?.content_length || 0), 0);

  const columns = [
    {
      title: "Name / URL",
      dataIndex: "name",
      width: 280,
      render: (name: string, step: Step) => {
        const method = step.timings?.method;
        const status = step.timings?.status_code;
        const url = step.timings?.url;
        
        if (step.timings?.is_network) {
          return (
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 260 }}>
              <Space>
                {status && (
                  <span style={{ 
                    fontSize: 10, 
                    fontWeight: "bold", 
                    color: status >= 400 ? "#ef4444" : "#10b981" 
                  }}>
                    {status}
                  </span>
                )}
                {method && <span style={{ fontSize: 10, fontWeight: "bold" }}>{method}</span>}
              </Space>
              <Typography.Text ellipsis style={{ width: 260, fontSize: 11 }} title={url || name}>
                {url || name}
              </Typography.Text>
            </div>
          );
        }

        if (step.timings?.is_event) {
          const color = step.status === "passed" ? "#10b981" : step.status === "error" || step.status === "failed" ? "#ef4444" : "#f59e0b";
          return (
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 260 }}>
              <Space>
                <span style={{ fontSize: 14, color }}>●</span>
                <span style={{ fontSize: 10, fontWeight: "bold" }}>{step.timings.event_type?.toUpperCase()}</span>
              </Space>
              <Typography.Text ellipsis style={{ width: 260, fontSize: 11 }} title={name}>
                {name}
              </Typography.Text>
            </div>
          );
        }

        return (
          <Typography.Text ellipsis style={{ width: 260 }} title={name}>
            {name}
          </Typography.Text>
        );
      },
    },
    {
      title: "Type",
      key: "type",
      width: 100,
      render: (_: any, step: Step) => (
        <span style={{ fontSize: 11, color: "#666" }}>
          {step.timings?.content_type || (step.timings?.is_network ? "unknown" : "")}
        </span>
      ),
    },
    {
      title: "Size",
      key: "size",
      width: 80,
      render: (_: any, step: Step) => {
        const size = step.timings?.content_length;
        if (size === undefined) return null;
        if (size < 1024) return <span style={{ fontSize: 11 }}>{size} B</span>;
        return <span style={{ fontSize: 11 }}>{(size / 1024).toFixed(1)} KB</span>;
      },
    },
    {
      title: "Duration",
      dataIndex: "duration_ms",
      width: 100,
      render: (ms: number) => `${ms} ms`,
    },
    {
      title: "Waterfall",
      key: "waterfall",
      render: (_: any, step: Step) => {
        const hasTimings = step.timings && (step.timings.dns !== undefined || step.timings.ttfb !== undefined);
        const dns = step.timings?.dns || 0;
        const ttfb = step.timings?.ttfb || 0;
        const download = step.timings?.download || 0;

        // If no granular timings, just show one solid bar for the whole duration
        if (!hasTimings) {
          const width = Math.max((step.duration_ms / maxDuration) * 100, 1);
          return (
            <div style={{ width: "100%", background: "#f0f0f0", height: 16, position: "relative", borderRadius: 2 }}>
              <Tooltip title={`Total: ${step.duration_ms}ms`}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    width: `${width}%`,
                    height: "100%",
                    background: step.status === "passed" ? "#10b981" : "#ef4444",
                    borderRadius: 2,
                  }}
                />
              </Tooltip>
            </div>
          );
        }

        const totalGranular = dns + ttfb + download;
        // In case the sum is slightly off from duration_ms, we use the max of both for scale
        const scaleBase = Math.max(step.duration_ms, totalGranular, 1);
        
        const dnsW = (dns / maxDuration) * 100;
        const ttfbW = (ttfb / maxDuration) * 100;
        const downW = (download / maxDuration) * 100;

        // Render event markers differently
        if (step.timings?.is_event) {
          return (
            <div style={{ width: "100%", height: 16, position: "relative" }}>
              <div style={{ 
                position: "absolute", 
                left: 0, 
                width: 2, 
                height: 24, 
                background: step.status === "passed" ? "#10b981" : "#ef4444",
                top: -4
              }} />
            </div>
          );
        }

        return (
          <div style={{ width: "100%", background: "transparent", height: 16, position: "relative", borderRadius: 2, display: "flex" }}>
            <Tooltip title={`DNS Lookup: ${dns}ms`}>
              <div style={{ width: `${dnsW}%`, background: "#3b82f6", height: "100%" }} />
            </Tooltip>
            <Tooltip title={`Connection / TTFB: ${ttfb}ms`}>
              <div style={{ width: `${ttfbW}%`, background: "#10b981", height: "100%" }} />
            </Tooltip>
            <Tooltip title={`Content Download: ${download}ms`}>
              <div style={{ width: `${downW}%`, background: "#8b5cf6", height: "100%" }} />
            </Tooltip>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, background: "#3b82f6", borderRadius: 2 }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>DNS Lookup</Typography.Text>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, background: "#10b981", borderRadius: 2 }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>TCP / TLS / TTFB</Typography.Text>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, background: "#8b5cf6", borderRadius: 2 }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Content Download</Typography.Text>
        </div>
      </Space>
      
      {/* Aggregate Stats */}
      {networkSteps.length > 0 && (
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "#f8fafc", borderRadius: 4, display: "flex", gap: 24, fontSize: 12 }}>
          <div><strong>Total Requests:</strong> {networkSteps.length}</div>
          <div><strong>Total Transferred:</strong> {totalSize < 1024 * 1024 ? (totalSize / 1024).toFixed(1) + " KB" : (totalSize / 1024 / 1024).toFixed(2) + " MB"}</div>
        </div>
      )}

      <Table
        rowKey={(record, idx) => record.id || String(idx)}
        size="small"
        pagination={false}
        dataSource={steps}
        columns={columns}
        expandable={{
          expandedRowRender: (record) => (
            <PayloadView payload={(record.timings as any)?.payload} details={(record.timings as any)?.details} />
          ),
          rowExpandable: (record) => !!((record.timings as any)?.payload || (record.timings as any)?.details),
        }}
      />
    </div>
  );
}
