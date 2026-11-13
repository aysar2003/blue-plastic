import type { Metadata } from 'next'

import { PURCHASE_REPORT_APPS } from '@/components/layout/module-hubs'
import { ModuleReportList } from '@/components/reports/module-report-list'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Purchase reports' }

export default async function PurchaseReportsHubPage() {
  await requireOrgContext('report:read')

  return (
    <ModuleReportList
      eyebrow="Purchases"
      title="Purchase reports"
      subtitle="What you bought, who you owe, and where the spending goes."
      apps={PURCHASE_REPORT_APPS}
    />
  )
}
