import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Button, Flex, Form, Input, Select, Space, Table, Tag, Typography,
  DatePicker,
} from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { FilterValue, SorterResult, FilterDropdownProps } from 'antd/es/table/interface'
import { SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { qtp } from '../api/qtp'
import type { AuditEventDto } from '../api/types'

const { RangePicker } = DatePicker

function fmt(value?: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'
}

function AuditFilterInput({ placeholder, setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps & { placeholder: string }) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const handle = (value: string) => {
    setSelectedKeys(value ? [value] : [])
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => confirm({ closeDropdown: false }), 350)
  }
  return (
    <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
      <Input
        autoFocus
        placeholder={placeholder}
        value={selectedKeys[0] as string}
        onChange={(e) => handle(e.target.value)}
        onPressEnter={() => confirm()}
        style={{ width: 200, marginBottom: 8, display: 'block' }}
        allowClear
      />
      <Space>
        <Button type="primary" size="small" onClick={() => confirm()} icon={<SearchOutlined />}>Search</Button>
        <Button size="small" onClick={() => { if (timer.current) clearTimeout(timer.current); clearFilters?.(); confirm() }}>Reset</Button>
      </Space>
    </div>
  )
}

function textFilterDropdown(placeholder: string) {
  return (props: FilterDropdownProps) => <AuditFilterInput placeholder={placeholder} {...props} />
}

const ACTION_FILTERS = [
  'CREATED', 'UPDATED', 'DELETED',
].map((v) => ({ text: v, value: v }))

export interface AuditFilterState {
  action?: string
  actor?: string
  entity_type?: string
  entity_id?: string
  correlation_id?: string
  created_after?: string
  created_before?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
  page?: number
  page_size?: number
  q?: string
  related_to?: string
}

export function getEntityUrl(row: AuditEventDto): string | null {
  const type = row.entity_type
  const id = row.entity_id
  if (!type || !id) return null

  if (type === 'entity_comments') {
    let obj: any = {}
    try { obj = typeof row.new_value === 'string' ? JSON.parse(row.new_value) : (row.new_value || {}) } catch (e) {}
    if (!obj.entity_type && !obj.entity_id) {
       try { obj = typeof row.old_value === 'string' ? JSON.parse(row.old_value) : (row.old_value || {}) } catch (e) {}
    }
    const t = obj.entity_type
    const targetId = obj.entity_id
    if (!t || !targetId) return null
    if (t === 'test_runs' || t === 'run') return `/runs/${targetId}`
    if (t === 'scenarios' || t === 'test') return `/scenarios/${targetId}`
    return null
  }

  if (type === 'scenarios') return `/scenarios/${id}`
  if (type === 'test_runs') return `/runs/${id}`
  if (type === 'schedules') return `/schedules/${id}`
  if (type === 'targets') return `/targets/${id}`
  if (type === 'workers') return `/workers/${id}`
  return null
}

function getAuditDescription(record: AuditEventDto, nav: ReturnType<typeof useNavigate>) {
  const { action, entity_type, actor, new_value, old_value } = record

  let newObj: any = {}
  let oldObj: any = {}
  try { newObj = typeof new_value === 'string' ? JSON.parse(new_value) : (new_value || {}) } catch (e) {}
  try { oldObj = typeof old_value === 'string' ? JSON.parse(old_value) : (old_value || {}) } catch (e) {}

  const actorName = (!actor || actor === '-' || actor === 'system') ? 'System' : `User (${actor})`

  if (entity_type === 'test_runs') {
    if (action === 'CREATED') {
      if (newObj.schedule_id) {
        return (
          <span>
            {actorName} automatically ran the scenario based on the schedule{' '}
            <a onClick={(e) => { e.stopPropagation(); nav(`/schedules/${newObj.schedule_id}`) }}>
              {newObj.schedule_id.slice(0, 8)}
            </a>.
          </span>
        )
      }
      return <span>{actorName} has run a scenario.</span>
    }
    if (action === 'UPDATED') {
      if (oldObj.status && newObj.status && oldObj.status !== newObj.status) {
        return (
          <span>
            {actorName} changed run state from <Tag bordered={false} style={{ marginInline: 4 }}>{oldObj.status}</Tag> to <Tag bordered={false} style={{ marginInline: 4 }}>{newObj.status}</Tag>.
          </span>
        )
      }
      if (newObj.defect_type || newObj.failure_signature) {
        return <span>{actorName} updated defect analysis for this run.</span>
      }
    }
  }

  if (entity_type === 'scenarios') {
    if (action === 'CREATED') return <span>{actorName} created a new scenario.</span>
    if (action === 'UPDATED') return <span>{actorName} updated scenario details.</span>
    if (action === 'DELETED') return <span>{actorName} deleted the scenario.</span>
  }

  if (entity_type === 'schedules') {
    if (action === 'CREATED') return <span>{actorName} created a new schedule.</span>
    if (action === 'UPDATED') {
      if (oldObj.is_enabled !== undefined && newObj.is_enabled !== undefined && oldObj.is_enabled !== newObj.is_enabled) {
        return <span>{actorName} {newObj.is_enabled ? 'enabled' : 'disabled'} the schedule.</span>
      }
      return <span>{actorName} updated the schedule.</span>
    }
    if (action === 'DELETED') return <span>{actorName} deleted the schedule.</span>
  }

  if (entity_type === 'comments') {
    if (action === 'CREATED') {
      return <span>{actorName} commented on this entity.</span>
    }
  }

  const entitySingular = entity_type ? entity_type.replace(/s$/, '').replace('_', ' ') : 'entity'
  return <span>{actorName} {action.toLowerCase()} this {entitySingular}.</span>
}

export function AuditTable({ baseFilters, onRowClick }: { baseFilters?: Partial<AuditFilterState>; onRowClick?: (record: AuditEventDto) => void }) {
  const nav = useNavigate()
  const [params, setParams] = useState<AuditFilterState>({ sort_by: 'created_at', sort_dir: 'desc', page: 1, page_size: 20, ...baseFilters })
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const audit = useQuery({
    queryKey: ['audit', params],
    queryFn: () => qtp.listAudit({ ...params }),
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
      render: (v) => (!v || v === '-') ? 'System' : v,
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
              onClick={(e) => { e.stopPropagation(); setParams((p) => ({ ...p, entity_type: row.entity_type })) }}
            >
              {row.entity_type}
            </Tag>
          )}
          <Typography.Text
            ellipsis
            style={{ fontSize: 12, maxWidth: 110, cursor: row.entity_id ? 'pointer' : 'default' }}
            onClick={(e) => { if (row.entity_id) { e.stopPropagation(); setParams((p) => ({ ...p, entity_id: row.entity_id! })) } }}
          >
            {row.entity_id || '-'}
          </Typography.Text>
        </Space>
      ),
      filterDropdown: textFilterDropdown('Entity ID (UUID)'),
      filteredValue: params.entity_id ? [params.entity_id] : null,
    },
    {
      title: 'Description',
      key: 'description',
      render: (_, row) => getAuditDescription(row, nav),
    },
    {
      title: 'Correlation ID',
      dataIndex: 'correlation_id',
      width: 240,
      ellipsis: true,
      filterDropdown: textFilterDropdown('Correlation ID'),
      filteredValue: params.correlation_id ? [params.correlation_id] : null,
    },
    {
      title: 'Link',
      width: 70,
      render: (_, row) => {
        if (!row.entity_type || !row.entity_id) return null
        const url = getEntityUrl(row)
        if (!url) return null
        return <a onClick={(e) => { e.stopPropagation(); nav(url) }}>View</a>
      }
    }
  ], [params])

  const handleTableChange = (
    _pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<AuditEventDto> | SorterResult<AuditEventDto>[]
  ) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    setParams((prev) => {
      const next: AuditFilterState = { ...prev, page: _pagination.current, page_size: _pagination.pageSize }
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

      const correlationFilters = filters['correlation_id'] || []
      if (correlationFilters.length) next.correlation_id = correlationFilters[0] as string
      else delete next.correlation_id

      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Flex justify="space-between">
        <Space>
          <Input
            placeholder="Search action or actor..."
            allowClear
            prefix={<SearchOutlined style={{ color: 'var(--qtp-text-tertiary)' }} />}
            onChange={(e) => {
              const val = e.target.value
              if (searchTimer.current) clearTimeout(searchTimer.current)
              searchTimer.current = setTimeout(() => setParams(p => ({ ...p, q: val || undefined, page: 1 })), 350)
            }}
            style={{ width: 250 }}
          />
        </Space>
        <Space>
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
        </Space>
      </Flex>
      <Table
        dataSource={audit.data?.items || []}
        rowKey="id"
        columns={columns}
        loading={audit.isLoading}
        size="small"
        pagination={{
          current: audit.data?.page || 1,
          pageSize: audit.data?.page_size || 20,
          total: audit.data?.total || 0,
          showSizeChanger: true,
        }}
        onChange={handleTableChange}
        expandable={{
          expandedRowRender: (record) => (
             <div style={{ padding: 16, backgroundColor: '#fafafa', borderRadius: 8 }}>
                {record.old_value && (
                  <div style={{ marginBottom: 8 }}>
                    <Typography.Text strong>Old Value:</Typography.Text>
                    <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(record.old_value, null, 2)}</pre>
                  </div>
                )}
                {record.new_value && (
                  <div>
                    <Typography.Text strong>New Value:</Typography.Text>
                    <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(record.new_value, null, 2)}</pre>
                  </div>
                )}
             </div>
          )
        }}
        onRow={(record) => ({
          onClick: () => {
            if (onRowClick) {
              onRowClick(record)
            } else if (record.entity_id) {
              nav(`/audit/${record.entity_id}`)
            }
          },
          style: { cursor: record.entity_id || onRowClick ? 'pointer' : 'default' }
        })}
      />
    </div>
  )
}
