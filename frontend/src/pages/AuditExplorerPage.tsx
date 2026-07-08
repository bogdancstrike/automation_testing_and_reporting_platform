import { Button, Space, Typography, Card } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { AuditTable } from '../components/AuditTable'

export default function AuditExplorerPage() {
  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Audit Explorer</Typography.Title>
          <Typography.Text type="secondary">Global event ledger across the system</Typography.Text>
        </div>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <AuditTable />
      </Card>
    </div>
  )
}
