import { Collapse, Space, Typography, Tag } from "antd";
import { CheckCircleFilled, CloseCircleFilled, WarningFilled } from "@ant-design/icons";
import CodeSnippet from "./CodeSnippet";

interface StepTreeProps {
  steps: any[];
  logs?: any[];
}

/** Classify a timeline entry so the trace reads correctly (these are auto-captured
 *  network calls / browser actions / events — not authored steps). */
function entryMeta(node: any): { label: string; color: string } {
  if (node.isLog) {
    const lvl = String(node.level || "info").toLowerCase();
    const color = lvl === "error" ? "var(--qtp-status-fail)" : lvl === "warning" ? "var(--qtp-status-timeout)" : "var(--qtp-text-tertiary)";
    return { label: lvl === "info" ? "Log" : lvl.toUpperCase(), color };
  }
  const t = node.timings || {};
  if (t.is_network) return { label: "Network", color: "var(--qtp-status-queued)" };
  if (t.is_event) {
    switch (t.event_type) {
      case "assertion": return { label: "Assertion", color: "var(--qtp-brand)" };
      case "console": return { label: node.status === "failed" ? "Console error" : "Console", color: "var(--qtp-status-timeout)" };
      case "navigation": return { label: "Navigation", color: "var(--qtp-text-secondary)" };
      case "warning": return { label: "Warning", color: "var(--qtp-status-timeout)" };
      default: return { label: "Event", color: "var(--qtp-text-secondary)" };
    }
  }
  if (t.is_step_block) return { label: "Action", color: "var(--qtp-status-running)" };
  return { label: "Step", color: "var(--qtp-text-secondary)" };
}

export default function StepTree({ steps, logs = [] }: StepTreeProps) {
  if (!steps || steps.length === 0) return null;

  // Map parent step IDs to their children
  const childrenMap = new Map<string, any[]>();
  const parentBlocks: any[] = [];
  const orphans: any[] = [];

  const logSteps = logs.map((log: any) => ({
    isLog: true,
    name: log.message,
    level: log.level,
    created_at: log.created_at,
    timings: {
      parent_step_id: log.context?.step_id,
      start_ms: log.context?.start_ms || 0
    }
  }));

  steps.forEach((s) => {
    if (s.timings?.is_step_block) {
      parentBlocks.push(s);
    } else if (s.timings?.parent_step_id) {
      if (!childrenMap.has(s.timings.parent_step_id)) {
        childrenMap.set(s.timings.parent_step_id, []);
      }
      childrenMap.get(s.timings.parent_step_id)!.push(s);
    } else {
      orphans.push(s);
    }
  });

  logSteps.forEach((log) => {
    if (log.timings.parent_step_id) {
      if (!childrenMap.has(log.timings.parent_step_id)) {
        childrenMap.set(log.timings.parent_step_id, []);
      }
      childrenMap.get(log.timings.parent_step_id)!.push(log);
    } else {
      orphans.push(log);
    }
  });

  // Combine parent blocks and orphans, sorted by start_ms
  const allTopLevel = [...parentBlocks, ...orphans].sort(
    (a, b) => (a.timings?.start_ms || 0) - (b.timings?.start_ms || 0)
  );

  // Trace composition summary — makes it clear these are auto-captured, not authored steps.
  const counts = { action: 0, network: 0, event: 0 };
  steps.forEach((s) => {
    if (s.timings?.is_network) counts.network++;
    else if (s.timings?.is_event) counts.event++;
    else counts.action++;
  });
  const summaryParts = [
    counts.action ? `${counts.action} action${counts.action === 1 ? "" : "s"}` : null,
    counts.network ? `${counts.network} network` : null,
    counts.event ? `${counts.event} event${counts.event === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  const renderStatusIcon = (status: string) => {
    if (status === "passed") return <CheckCircleFilled style={{ color: "var(--qtp-status-pass)" }} />;
    if (status === "failed" || status === "error") return <CloseCircleFilled style={{ color: "var(--qtp-status-fail)" }} />;
    if (status === "timeout") return <WarningFilled style={{ color: "var(--qtp-status-timeout)" }} />;
    return <Tag color="default">{status}</Tag>;
  };

  const renderAssertionDiff = (details: any) => {
    if (!details || (!details.expected && !details.actual && !details.message)) return null;

    let content = "";
    if (details.message) content += `Message: ${details.message}\n`;
    if (details.expected !== undefined) {
      content += `Expected:\n${JSON.stringify(details.expected, null, 2)}\n\n`;
    }
    if (details.actual !== undefined) {
      content += `Actual:\n${JSON.stringify(details.actual, null, 2)}`;
    }

    return (
      <div style={{ marginTop: 8, padding: 12, background: "var(--qtp-subtle-bg)", borderRadius: 6, borderLeft: "4px solid var(--qtp-surface-border-strong)" }}>
        <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
          Assertion Failure Detail
        </Typography.Text>
        <CodeSnippet language="json" code={content.trim()} maxHeight={300} />
      </div>
    );
  };

  const renderChildNode = (child: any, index: number) => {
    if (child.isLog) {
      const color = child.level === "error" ? "var(--qtp-status-fail)" : child.level === "warning" ? "var(--qtp-status-timeout)" : "var(--qtp-text-tertiary)";
      return (
        <div key={`log-${index}`} style={{ padding: "4px 0", borderBottom: "1px dashed var(--qtp-surface-border)" }}>
          <Space align="start">
            <Typography.Text type="secondary" style={{ fontSize: 11, fontFamily: "var(--qtp-mono, monospace)", width: 45, color }}>
              {child.level.toUpperCase()}
            </Typography.Text>
            <Typography.Text style={{ fontSize: 13, color: child.level === "error" ? "var(--qtp-status-fail)" : "var(--qtp-text-secondary)", whiteSpace: "pre-wrap" }}>
              {child.name}
            </Typography.Text>
          </Space>
        </div>
      );
    }

    const isAssertion = child.timings?.is_event && child.timings?.event_type === "assertion";
    const details = child.timings?.details;
    const isFailed = child.status === "failed" || child.status === "error";

    return (
      <div key={index} style={{ padding: "8px 0", borderBottom: "1px solid var(--qtp-surface-border)" }}>
        <Space align="start">
          <div style={{ marginTop: 2 }}>{renderStatusIcon(child.status)}</div>
          <div>
            <Typography.Text strong={isAssertion} style={{ color: isFailed ? "var(--qtp-status-fail)" : undefined }}>
              {isAssertion ? "Expected result: " : ""}
              {child.name}
            </Typography.Text>
            {child.duration_ms > 0 && (
              <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                {child.duration_ms}ms
              </Typography.Text>
            )}

            {isFailed && child.error && !isAssertion && (
              <div style={{ marginTop: 4, color: "var(--qtp-status-fail)", fontSize: 13 }}>{child.error}</div>
            )}
            {isFailed && isAssertion && renderAssertionDiff(details)}
          </div>
        </Space>
      </div>
    );
  };

  const items = allTopLevel.map((node, i) => {
    const isBlock = node.timings?.is_step_block;
    const isFailed = node.status === "failed" || node.status === "error";
    const meta = entryMeta(node);
    const children = (isBlock ? childrenMap.get(node.timings?.step_id) || [] : []).sort(
      (a, b) => (a.timings?.start_ms || 0) - (b.timings?.start_ms || 0)
    );

    // Parent header
    const header = (
      <Space>
        {!node.isLog && renderStatusIcon(node.status)}
        <Tag bordered={false} style={{ color: meta.color, background: "var(--qtp-subtle-bg)", fontSize: 11, marginInlineEnd: 4 }}>
          {meta.label}
        </Tag>
        <Typography.Text strong style={{ color: isFailed ? "var(--qtp-status-fail)" : undefined }}>
          {node.name}
        </Typography.Text>
        {node.duration_ms > 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {node.duration_ms}ms
          </Typography.Text>
        )}
      </Space>
    );

    if (isBlock) {
      return {
        key: String(i),
        label: header,
        children: children.length > 0 || (isFailed && node.error) ? (
          <div style={{ paddingLeft: 24 }}>
            {children.map((c, idx) => renderChildNode(c, idx))}
            {isFailed && node.error && (
              <div style={{ padding: "8px 0", color: "var(--qtp-status-fail)", fontSize: 13 }}>
                <Typography.Text strong style={{ color: "var(--qtp-status-fail)" }}>Unhandled Error: </Typography.Text>
                {node.error}
              </div>
            )}
          </div>
        ) : (
          <Typography.Text type="secondary" style={{ paddingLeft: 24, fontSize: 13 }}>No inner steps recorded.</Typography.Text>
        ),
      };
    } else {
      // Standalone node
      return {
        key: String(i),
        label: header,
        children: renderChildNode(node, 0),
      };
    }
  });

  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12.5, marginBottom: 10 }}>
        Auto-captured execution trace{summaryParts.length ? ` — ${summaryParts.join(" · ")}` : ""}. Browser actions,
        network calls, console messages, and assertions are recorded automatically; use{" "}
        <Typography.Text code>ctx.step("…")</Typography.Text> to group them into named steps.
      </Typography.Paragraph>
      <Collapse
        defaultActiveKey={items.filter((it: any) => {
          const failed = allTopLevel[Number(it.key)]?.status;
          return failed === "failed" || failed === "error";
        }).map((it) => it.key)}
        items={items}
        style={{ background: "var(--qtp-surface-bg)" }}
      />
    </div>
  );
}
