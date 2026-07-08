import React from "react";
import { Table, Typography, Space, Tooltip } from "antd";

interface Timings {
  dns?: number;
  ttfb?: number;
  download?: number;
}

interface Step {
  id?: string;
  name: string;
  status: string;
  duration_ms: number;
  timings?: Timings;
  error?: string;
}

interface WaterfallChartProps {
  steps: Step[];
}

export default function WaterfallChart({ steps }: WaterfallChartProps) {
  // Find the total duration across all steps to calculate percentages
  const maxDuration = steps.reduce((max, step) => Math.max(max, step.duration_ms), 100);

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      width: 250,
      render: (name: string, step: Step) => (
        <Typography.Text ellipsis style={{ width: 230 }} title={name}>
          {name}
        </Typography.Text>
      ),
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
      <Table
        rowKey={(record, idx) => record.id || String(idx)}
        size="small"
        pagination={false}
        dataSource={steps}
        columns={columns}
      />
    </div>
  );
}
