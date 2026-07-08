import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Button, Empty, Flex, Form, Input, Select, Space, Table, Tag, Typography,
  Descriptions, Card, DatePicker, theme as antTheme,
} from 'antd'
import { AuditTimeline } from '../components/AuditTimeline'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { FilterValue, SorterResult, FilterDropdownProps } from 'antd/es/table/interface'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { qtp } from '../api/qtp'
import type { AuditEventDto } from '../api/types'

const { RangePicker } = DatePicker

function fmt(value?: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'
}

function AuditValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <Typography.Text type="secondary">null</Typography.Text>
  if (typeof value === 'object') {
    return <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(value, null, 2)}</pre>
  }
  return String(value)
}

function textFilterDropdown(placeholder: string) {
  return ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
    <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
      <Input
        autoFocus
        placeholder={placeholder}
        value={selectedKeys[0] as string}
        onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
        onPressEnter={() => confirm()}
        style={{ width: 200, marginBottom: 8, display: 'block' }}
        allowClear
      />
      <Space>
        <Button type="primary" size="small" onClick={() => confirm()} icon={<SearchOutlined />}>Search</Button>
        <Button size="small" onClick={() => { clearFilters?.(); confirm() }}>Reset</Button>
      </Space>
    </div>
  )
}

const ACTION_FILTERS = [
  'CREATED', 'UPDATED', 'DELETED',
].map((v) => ({ text: v, value: v }))

const ENTITY_TYPES = [
  'targets', 'test_definitions', 'schedules', 'test_runs',
]

interface AuditFilterState {
  action?: string
  actor?: string
  entity_type?: string
  entity_id?: string
  correlation_id?: string
  created_after?: string
  created_before?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export default function AuditExplorerPage() {
  const { token } = antTheme.useToken()
  const [params, setParams] = useState<AuditFilterState>({ sort_by: 'created_at', sort_dir: 'desc' })
  const audit = useQuery({
    queryKey: ['audit', params],
    queryFn: () => qtp.listAudit({ ...params, limit: 200 }),
  })

  const columns: ColumnsType<AuditEventDto> = useMemo(() => [
    {
      title: 'Time',
      dataIndex: 'created_at',
      width: 190,
      render: fmt,
      sorter: { multiple: 0 },
      defaultSortOrder: 'descend' as const,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      width: 130,
      render: (v) => <Tag color={v === 'DELETED' ? 'red' : v === 'UPDATED' ? 'blue' : 'green'}>{v}</Tag>,
      sorter: { multiple: 0 },
      filters: ACTION_FILTERS,
      filteredValue: params.action ? [params.action] : null,
      filterMultiple: false,
      filterSearch: true,
    },
    {
      title: 'Actor',
      dataIndex: 'actor',
      width: 180,
      render: (v) => v || '-',
      sorter: { multiple: 0 },
      filterDropdown: textFilterDropdown('Search actor'),
      filteredValue: params.actor ? [params.actor] : null,
    },
    {
      title: 'Entity',
      width: 200,
      render: (_, row) => (
        <Space size={4} wrap>
          {row.entity_type && (
            <Tag
              color="geekblue"
              style={{ cursor: 'pointer', fontSize: 11 }}
              onClick={() => setParams((p) => ({ ...p, entity_type: row.entity_type }))}
            >
              {row.entity_type}
            </Tag>
          )}
          <Typography.Text
            ellipsis
            style={{ fontSize: 12, maxWidth: 110, cursor: row.entity_id ? 'pointer' : 'default' }}
            onClick={() => row.entity_id && setParams((p) => ({ ...p, entity_id: row.entity_id! }))}
          >
            {row.entity_id || '-'}
          </Typography.Text>
        </Space>
      ),
      filterDropdown: textFilterDropdown('Entity ID (UUID)'),
      filteredValue: params.entity_id ? [params.entity_id] : null,
    },
    {
      title: 'Correlation ID',
      dataIndex: 'correlation_id',
      width: 240,
      ellipsis: true,
      filterDropdown: textFilterDropdown('Correlation ID'),
      filteredValue: params.correlation_id ? [params.correlation_id] : null,
    },
  ], [params])

  const handleTableChange = (
    _pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<AuditEventDto> | SorterResult<AuditEventDto>[]
  ) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    setParams((prev) => {
      const next: AuditFilterState = { ...prev }
      if (s && s.field) {
        next.sort_by = s.field as string
        next.sort_dir = s.order === 'ascend' ? 'asc' : s.order === 'descend' ? 'desc' : undefined
      }
      
      const actFilters = filters['action'] || []
      if (actFilters.length) next.action = actFilters[0] as string
      else delete next.action

      const actorFilters = filters['actor'] || []
      if (actorFilters.length) next.actor = actorFilters[0] as string
      else delete next.actor

      const entityFilters = filters['Entity'] || []
      if (entityFilters.length) next.entity_id = entityFilters[0] as string
      else if (!next.entity_type) delete next.entity_id

      return next
    })
  }

  return (
    <div style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Audit Explorer</Typography.Title>
          <Typography.Text type="secondary">Global event ledger across the system</Typography.Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => audit.refetch()}>Refresh</Button>
        </Space>
      </Flex>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Form layout="inline" size="small">
          <Form.Item label="Time range">
            <RangePicker
              showTime
              onChange={(dates) => {
                setParams((p) => {
                  const next = { ...p }
                  if (dates && dates[0] && dates[1]) {
                    next.created_after = dates[0].toISOString()
                    next.created_before = dates[1].toISOString()
                  } else {
                    delete next.created_after
                    delete next.created_before
                  }
                  return next
                })
              }}
            />
          </Form.Item>
          <Form.Item label="Entity type">
            <Select
              allowClear
              style={{ width: 160 }}
              options={ENTITY_TYPES.map(t => ({ value: t, label: t }))}
              value={params.entity_type}
              onChange={(v) => setParams((p) => {
                const next = { ...p }
                if (v) next.entity_type = v
                else delete next.entity_type
                return next
              })}
            />
          </Form.Item>
        </Form>
      </Card>

      <Table
        dataSource={audit.data?.items || []}
        rowKey="id"
        columns={columns}
        loading={audit.isLoading}
        size="small"
        pagination={false}
        onChange={handleTableChange}
        expandable={{
          expandedRowRender: (record) => (
            <div style={{ padding: '16px 24px', background: token.colorFillAlter }}>
              <Descriptions size="small" column={2} bordered style={{ background: token.colorBgContainer }}>
                <Descriptions.Item label="Record ID">{record.id}</Descriptions.Item>
                <Descriptions.Item label="IP Address">{record.request_ip || '-'}</Descriptions.Item>
                <Descriptions.Item label="User Agent" span={2}>{record.user_agent || '-'}</Descriptions.Item>
              </Descriptions>
              
              <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
                <div style={{ flex: 1 }}>
                  <Typography.Text strong>Old Value</Typography.Text>
                  <Card size="small" style={{ marginTop: 8, height: 200, overflowY: 'auto' }}>
                    <AuditValue value={record.old_value} />
                  </Card>
                </div>
                <div style={{ flex: 1 }}>
                  <Typography.Text strong>New Value</Typography.Text>
                  <Card size="small" style={{ marginTop: 8, height: 200, overflowY: 'auto' }}>
                    <AuditValue value={record.new_value} />
                  </Card>
                </div>
              </div>

              {record.metadata && Object.keys(record.metadata).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Typography.Text strong>Metadata</Typography.Text>
                  <Card size="small" style={{ marginTop: 8 }}>
                    <AuditValue value={record.metadata} />
                  </Card>
                </div>
              )}
            </div>
          ),
          expandRowByClick: true,
        }}
      />
    </div>
  )
}
