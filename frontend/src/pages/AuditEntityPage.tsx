import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Card, Typography, Space, Breadcrumb } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { qtp } from '../api/qtp'
import { AuditTimeline } from '../components/AuditTimeline'

export default function AuditEntityPage() {
  const { id } = useParams()
  const nav = useNavigate()
  
  const { data: auditEvents = [], isLoading } = useQuery({
    queryKey: ['audit-entity', id],
    queryFn: () => qtp.listAudit({ entity_id: id, limit: 1000 }).then(r => r.items),
    enabled: !!id,
  })

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 16 }}>
        <Breadcrumb.Item>
          <a onClick={() => nav('/audit')}>Audit Ledger</a>
        </Breadcrumb.Item>
        <Breadcrumb.Item>Entity {id}</Breadcrumb.Item>
      </Breadcrumb>

      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav(-1)}>Back</Button>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Audit History
        </Typography.Title>
      </Space>

      <Card>
        <Typography.Paragraph type="secondary">
          Displaying all recorded events for entity ID <Typography.Text code>{id}</Typography.Text>
        </Typography.Paragraph>
        
        <div style={{ marginTop: 24 }}>
          <AuditTimeline events={auditEvents} loading={isLoading} />
        </div>
      </Card>
    </div>
  )
}
