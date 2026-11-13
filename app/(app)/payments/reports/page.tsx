import type { Metadata } from 'next'

import { PAYMENT_REPORT_APPS } from '@/components/layout/module-hubs'
import { ModuleReportList } from '@/components/reports/module-report-list'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Payment reports' }

export default async function PaymentReportsHubPage() {
  await requireOrgContext('report:read')

  return (
    <ModuleReportList
      eyebrow="Payments"
      title="Payment reports"
      subtitle="Money received, what is still open, and who is overdue."
      apps={PAYMENT_REPORT_APPS}
    />
  )
}
