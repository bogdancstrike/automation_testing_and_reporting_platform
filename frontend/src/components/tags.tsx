import { Tag } from "antd";

const RUN_COLORS: Record<string, string> = {
  passed: "success",
  failed: "error",
  error: "volcano",
  timeout: "orange",
  canceled: "default",
  skipped: "default",
  running: "processing",
  claimed: "processing",
  queued: "blue",
};

export function StatusTag({ status }: { status?: string }) {
  if (!status) return <Tag>—</Tag>;
  return <Tag color={RUN_COLORS[status] || "default"}>{status}</Tag>;
}

const DEFECT_COLORS: Record<string, string> = {
  product_bug: "red",
  automation_bug: "gold",
  system_issue: "purple",
  to_investigate: "blue",
  no_defect: "green",
};

export function DefectTag({ defect }: { defect?: string }) {
  if (!defect) return <Tag color="default">untriaged</Tag>;
  return <Tag color={DEFECT_COLORS[defect] || "default"}>{defect.replace(/_/g, " ")}</Tag>;
}

export function TypeTag({ type }: { type: string }) {
  const colors: Record<string, string> = {
    http_request: "geekblue", python_script: "cyan", playwright: "magenta",
    selenium: "purple", cli: "orange",
  };
  return <Tag color={colors[type] || "default"}>{type}</Tag>;
}

export function Duration({ ms }: { ms?: number | null }) {
  if (ms === null || ms === undefined) return <span>—</span>;
  if (ms < 1000) return <span>{ms} ms</span>;
  return <span>{(ms / 1000).toFixed(2)} s</span>;
}
