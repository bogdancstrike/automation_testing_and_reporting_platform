import { App, Avatar, Button, Form, Input, Select, Space, Tag, Typography } from "antd";
import { MessageOutlined, UserOutlined } from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qtp } from "../api/qtp";
import { formatLocalTime } from "./tags";

type Comment = {
  author?: string;
  body?: string;
  created_at?: string;
  tags?: string[];
};

const AVATAR_PALETTE = [
  "#1677ff", "#52c41a", "#722ed1", "#fa8c16",
  "#eb2f96", "#13c2c2", "#faad14", "#2f54eb",
];

function initials(name: string): string {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  const i = (parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
  return (i || name?.[0] || "?").toUpperCase();
}

function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  return `${Math.round(months / 12)} year${months < 24 ? "" : "s"} ago`;
}

export default function RunComments({
  runId,
  comments,
  allTags,
}: {
  runId: string;
  comments: Comment[];
  allTags: string[];
}) {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { message } = App.useApp();

  const addComment = useMutation({
    mutationFn: (v: { body: string; tags: string[] }) => qtp.createRunComment(runId, v.body, v.tags),
    onSuccess: () => {
      message.success("Comment added");
      qc.invalidateQueries({ queryKey: ["runComments", runId] });
      form.resetFields();
    },
    onError: (e: any) => message.error(e.message || "failed to add comment"),
  });

  return (
    <div className="qtp-comments">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <MessageOutlined style={{ color: "var(--qtp-text-secondary, #8c8c8c)" }} />
        <Typography.Title level={4} style={{ margin: 0 }}>
          Comments
        </Typography.Title>
        <Tag style={{ borderRadius: 10, marginInlineStart: 4 }}>{comments.length}</Tag>
      </div>

      {comments.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "28px 12px",
            border: "1px dashed var(--qtp-surface-border)",
            borderRadius: 10,
            color: "var(--qtp-text-secondary, #8c8c8c)",
          }}
        >
          <MessageOutlined style={{ fontSize: 22, opacity: 0.5 }} />
          <div style={{ marginTop: 8 }}>No comments yet — start the discussion.</div>
        </div>
      ) : (
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* timeline spine */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 17,
              top: 8,
              bottom: 8,
              width: 2,
              background: "var(--qtp-surface-border)",
              opacity: 0.6,
            }}
          />
          {comments.map((c, idx) => (
            <div key={idx} style={{ display: "flex", gap: 12, position: "relative" }}>
              <Avatar
                size={36}
                style={{ background: avatarColor(c.author || ""), flex: "0 0 auto", fontWeight: 600, zIndex: 1 }}
              >
                {initials(c.author || "?")}
              </Avatar>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: "1px solid var(--qtp-surface-border)",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "var(--qtp-surface, transparent)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    padding: "8px 14px",
                    background: "rgba(125,125,125,0.06)",
                    borderBottom: "1px solid var(--qtp-surface-border)",
                  }}
                >
                  <Typography.Text strong>{c.author || "Unknown"}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }} title={c.created_at ? formatLocalTime(c.created_at) : undefined}>
                    commented {timeAgo(c.created_at || "")}
                  </Typography.Text>
                  <span style={{ flex: 1 }} />
                  {(c.tags || []).map((t) => (
                    <Tag key={t} color="purple" style={{ marginInlineEnd: 0 }}>
                      {t}
                    </Tag>
                  ))}
                </div>
                <div style={{ padding: "12px 14px", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                  {c.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* composer */}
      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <Avatar size={36} icon={<UserOutlined />} style={{ flex: "0 0 auto" }} />
        <div
          style={{
            flex: 1,
            border: "1px solid var(--qtp-surface-border)",
            borderRadius: 10,
            padding: 12,
          }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={(v) => addComment.mutate({ body: v.body, tags: v.tags || [] })}
          >
            <Form.Item
              name="body"
              rules={[{ required: true, message: "Comment body is required" }]}
              style={{ marginBottom: 10 }}
            >
              <Input.TextArea rows={3} placeholder="Write a comment…" autoSize={{ minRows: 3, maxRows: 10 }} />
            </Form.Item>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Form.Item name="tags" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
                <Select
                  mode="tags"
                  style={{ width: "100%" }}
                  placeholder="Add tags…"
                  options={allTags.map((t) => ({ value: t, label: t }))}
                />
              </Form.Item>
              <Space>
                <Button onClick={() => form.resetFields()}>Cancel</Button>
                <Button type="primary" htmlType="submit" loading={addComment.isPending}>
                  Comment
                </Button>
              </Space>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
