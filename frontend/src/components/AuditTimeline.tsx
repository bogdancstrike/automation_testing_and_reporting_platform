import { useMemo, useState } from 'react'
import { Card, Descriptions, Empty, Space, Tag, Typography, theme as antTheme, Tooltip } from 'antd'
import { CaretRightOutlined, CaretDownOutlined } from '@ant-design/icons'
import { qtp } from '../api/qtp'
import type { AuditEventDto } from '../api/types'
import dayjs from 'dayjs'

const ACTION_COLORS: Record<string, string> = {
  CREATED: 'green',
  UPDATED: 'blue',
  DELETED: 'red',
}

function actionLabel(action: string): string {
  return action.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}

function eventTitle(event: AuditEventDto): string {
  if (event.entity_type === 'test_runs') {
    if (event.action === 'CREATED') return 'Run created and queued'
    if (event.action === 'UPDATED') {
      const oldStatus = event.old_value?.status
      const newStatus = event.new_value?.status
      if (oldStatus !== newStatus && newStatus) {
        if (newStatus === 'running') return 'Run started execution'
        if (newStatus === 'passed') return 'Run finished (passed)'
        if (newStatus === 'failed') return 'Run finished (failed)'
        if (newStatus === 'canceled') return 'Run canceled'
        return `Run changed state to ${newStatus}`
      }
      return 'Run updated'
    }
    if (event.action === 'DELETED') return 'Run deleted'
  }
  
  if (event.entity_type === 'scenarios') {
    if (event.action === 'CREATED') return 'Scenario created'
    if (event.action === 'UPDATED') return 'Scenario updated'
    if (event.action === 'DELETED') return 'Scenario deleted'
  }
  
  if (event.entity_type === 'schedules') {
    if (event.action === 'CREATED') return 'Schedule created'
    if (event.action === 'UPDATED') {
      const oldStatus = event.old_value?.status
      const newStatus = event.new_value?.status
      if (oldStatus !== newStatus && newStatus) {
         if (newStatus === 'paused') return 'Schedule paused'
         if (newStatus === 'active') return 'Schedule activated'
      }
      return 'Schedule updated'
    }
    if (event.action === 'DELETED') return 'Schedule deleted'
  }

  return actionLabel(event.action)
}

function valueDiff(old?: Record<string, unknown> | null, next?: Record<string, unknown> | null) {
  if (!old && !next) return null
  if (!old && next) {
    return Object.entries(next).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => ({ key: k, old: undefined, next: v }))
  }
  if (old && !next) {
    return Object.entries(old).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => ({ key: k, old: v, next: undefined }))
  }
  const keys = new Set([...Object.keys(old || {}), ...Object.keys(next || {})])
  const diffs: Array<{ key: string; old: unknown; next: unknown }> = []
  keys.forEach(k => {
    const a = (old as any)?.[k]
    const b = (next as any)?.[k]
    if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push({ key: k, old: a, next: b })
  })
  return diffs
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return '∅'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function AuditDiff({ event }: { event: AuditEventDto }) {
  const diffs = useMemo(() => valueDiff(event.old_value, event.new_value), [event])
  if (!diffs || diffs.length === 0) return <Typography.Text type="secondary">No field changes recorded.</Typography.Text>
  return (
    <Descriptions size="small" column={1} bordered>
      {diffs.slice(0, 12).map(d => (
        <Descriptions.Item key={d.key} label={d.key}>
          {d.old !== undefined && <Typography.Text delete type="secondary">{fmtVal(d.old)}</Typography.Text>}
          {d.old !== undefined && d.next !== undefined && <Typography.Text type="secondary"> → </Typography.Text>}
          {d.next !== undefined && <Typography.Text strong>{fmtVal(d.next)}</Typography.Text>}
        </Descriptions.Item>
      ))}
    </Descriptions>
  )
}

function AuditCard({ event, expanded, onToggle }: { event: AuditEventDto; expanded: boolean; onToggle: () => void }) {
  const { token } = antTheme.useToken()
  const color = ACTION_COLORS[event.action] || 'default'
  return (
    <Card
      size="small"
      style={{
        marginBottom: 12,
        borderLeft: `3px solid ${token.colorPrimary}`,
        cursor: 'pointer',
      }}
      onClick={onToggle}
      styles={{ body: { padding: 12 } }}
    >
      <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
        <Space direction="vertical" size={4} style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Tag color={ACTION_COLORS[event.action] || 'default'} style={{ margin: 0 }}>
                {actionLabel(event.action)}
              </Tag>
              <Typography.Text strong>{eventTitle(event)}</Typography.Text>
            </Space>
            <Tooltip title={dayjs(event.created_at).format('YYYY-MM-DD HH:mm:ss')}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {dayjs(event.created_at).fromNow()}
              </Typography.Text>
            </Tooltip>
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>{event.actor || 'system'}</Typography.Text>
        </Space>
        {expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
      </Space>
      {expanded && (
        <div style={{ marginTop: 12 }}>
          <AuditDiff event={event} />
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Metadata: {JSON.stringify(event.metadata)}
              </Typography.Text>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export function AuditTimeline({ events, loading }: { events: AuditEventDto[]; loading?: boolean }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  if (!loading && events.length === 0) {
    return <Empty description="No audit events" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }
  return (
    <div style={{ position: 'relative' }}>
      {loading && <div style={{ textAlign: 'center', padding: 20 }}><Typography.Text type="secondary">Loading...</Typography.Text></div>}
      {events.map((e) => (
        <AuditCard
          key={e.id}
          event={e}
          expanded={expanded.has(e.id)}
          onToggle={() =>
            setExpanded(prev => {
              const next = new Set(prev)
              if (next.has(e.id)) next.delete(e.id)
              else next.add(e.id)
              return next
            })
          }
        />
      ))}
    </div>
  )
}
