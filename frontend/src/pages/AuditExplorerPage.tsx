import { PageHeader } from '../components/PageHeader'
import { AuditTable } from '../components/AuditTable'

export default function AuditExplorerPage() {
  return (
    <div>
      <PageHeader title="Audit" subtitle="Global event ledger across the system" />
      <AuditTable />
    </div>
  )
}
