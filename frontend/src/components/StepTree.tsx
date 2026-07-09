import { Collapse, Space, Typography, Tag, Row, Col } from "antd";
import { CheckCircleFilled, CloseCircleFilled, WarningFilled } from "@ant-design/icons";
import CodeSnippet from "./CodeSnippet";

interface StepTreeProps {
  steps: any[];
}

export default function StepTree({ steps }: StepTreeProps) {
  if (!steps || steps.length === 0) return null;

  // Map parent step IDs to their children
  const childrenMap = new Map<string, any[]>();
  const parentBlocks: any[] = [];
  const orphans: any[] = [];

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

  // Combine parent blocks and orphans, sorted by start_ms
  const allTopLevel = [...parentBlocks, ...orphans].sort(
    (a, b) => (a.timings?.start_ms || 0) - (b.timings?.start_ms || 0)
  );

  const renderStatusIcon = (status: string) => {
    if (status === "passed") return <CheckCircleFilled style={{ color: "#52c41a" }} />;
    if (status === "failed" || status === "error") return <CloseCircleFilled style={{ color: "#f5222d" }} />;
    if (status === "timeout") return <WarningFilled style={{ color: "#faad14" }} />;
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
      <div style={{ marginTop: 8, padding: 12, background: "#f5f5f5", borderRadius: 6, borderLeft: "4px solid #d9d9d9" }}>
        <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
          Assertion Failure Detail
        </Typography.Text>
        <CodeSnippet language="json" code={content.trim()} maxHeight={300} />
      </div>
    );
  };

  const renderChildNode = (child: any, index: number) => {
    const isAssertion = child.timings?.is_event && child.timings?.event_type === "assertion";
    const details = child.timings?.details;
    const isFailed = child.status === "failed" || child.status === "error";

    return (
      <div key={index} style={{ padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
        <Space align="start">
          <div style={{ marginTop: 2 }}>{renderStatusIcon(child.status)}</div>
          <div>
            <Typography.Text strong={isAssertion} style={{ color: isFailed ? "#f5222d" : undefined }}>
              {isAssertion ? "Expected result: " : ""}
              {child.name}
            </Typography.Text>
            {child.duration_ms > 0 && (
              <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                {child.duration_ms}ms
              </Typography.Text>
            )}
            
            {isFailed && child.error && !isAssertion && (
              <div style={{ marginTop: 4, color: "#f5222d", fontSize: 13 }}>{child.error}</div>
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
    const children = isBlock ? childrenMap.get(node.timings?.step_id) || [] : [];
    
    // Parent header
    const header = (
      <Space>
        {renderStatusIcon(node.status)}
        <Typography.Text strong style={{ color: isFailed ? "#f5222d" : undefined }}>
          {i + 1}. {node.name}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {node.duration_ms}ms
        </Typography.Text>
      </Space>
    );

    if (isBlock) {
      return {
        key: String(i),
        label: header,
        children: children.length > 0 ? (
          <div style={{ paddingLeft: 24 }}>
            {children.map((c, idx) => renderChildNode(c, idx))}
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
    <Collapse 
      defaultActiveKey={items.filter(it => it.label.props.children[1].props.style?.color === "#f5222d").map(it => it.key)}
      items={items} 
      style={{ background: "#fff" }}
    />
  );
}
