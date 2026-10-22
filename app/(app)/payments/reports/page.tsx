import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { PAYMENT_REPORT_APPS } from '@/components/layout/module-hubs'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Payment reports' }

export default async function PaymentReportsHubPage() {
  await requireOrgContext('report:read')

  return (
    <AppLauncher
      eyebrow="Payments"
      title="Payment reports"
      subtitle="Money received, what is still open, and who is overdue."
      apps={PAYMENT_REPORT_APPS}
      searchable
    />
  )
}
