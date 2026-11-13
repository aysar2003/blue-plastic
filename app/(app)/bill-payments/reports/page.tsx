import type { Metadata } from 'next'

import { BILL_PAYMENT_REPORT_APPS } from '@/components/layout/module-hubs'
import { ModuleReportList } from '@/components/reports/module-report-list'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Bill payment reports' }

export default async function BillPaymentReportsHubPage() {
  await requireOrgContext('report:read')

  return (
    <ModuleReportList
      eyebrow="Bill payments"
      title="Bill payment reports"
      subtitle="Money paid out, open bills, and what you still owe."
      apps={BILL_PAYMENT_REPORT_APPS}
    />
  )
}
