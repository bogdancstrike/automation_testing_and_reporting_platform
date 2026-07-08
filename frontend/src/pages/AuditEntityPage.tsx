import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Card, Typography, Space, Breadcrumb } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { qtp } from '../api/qtp'
import { AuditTable, getEntityUrl } from '../components/AuditTable'

export default function AuditEntityPage() {
  const { id } = useParams()
  const nav = useNavigate()
  
  const { data: auditEvents = [], isLoading } = useQuery({
    queryKey: ['audit-entity', id],
    queryFn: () => qtp.listAudit({ related_to: id, limit: 1 }).then(r => r.items),
    enabled: !!id,
  })

  // Deduce the entity type from the first event that actually targets this ID natively
  const targetEvent = auditEvents.find(e => e.entity_id === id)
  const entityType = targetEvent?.entity_type || 'Unknown Entity'
  const entityUrl = targetEvent ? getEntityUrl(targetEvent) : null

  const idDisplay = entityUrl ? (
    <a onClick={() => nav(entityUrl)} style={{ cursor: 'pointer' }}>
      <Typography.Text code style={{ color: '#1677ff', cursor: 'pointer' }}>{id}</Typography.Text>
    </a>
  ) : (
    <Typography.Text code>{id}</Typography.Text>
  )

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 16 }}>
        <Breadcrumb.Item>
          <a onClick={() => nav('/audit')}>Audit Ledger</a>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          {entityType.replace('_', ' ')} {idDisplay}
        </Breadcrumb.Item>
      </Breadcrumb>

      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav(-1)}>Back</Button>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Audit History
        </Typography.Title>
      </Space>

      <Card>
        <Typography.Paragraph type="secondary">
          Displaying all recorded events for {entityType.replace('_', ' ')} {idDisplay} and its related branches.
        </Typography.Paragraph>
        
        <div style={{ marginTop: 24 }}>
          <AuditTable baseFilters={{ related_to: id }} />
        </div>
      </Card>
    </div>
  )
}
