import type { Metadata } from 'next'

import { INVENTORY_REPORT_APPS } from '@/components/layout/module-hubs'
import { ModuleReportList } from '@/components/reports/module-report-list'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Inventory reports' }

export default async function InventoryReportsHubPage() {
  await requireOrgContext('report:read')

  return (
    <ModuleReportList
      eyebrow="Inventory"
      title="Inventory reports"
      subtitle="What is on hand, what it is worth, and what moved."
      apps={INVENTORY_REPORT_APPS}
    />
  )
}
