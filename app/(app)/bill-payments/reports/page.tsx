import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { BILL_PAYMENT_REPORT_APPS } from '@/components/layout/module-hubs'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Bill payment reports' }

export default async function BillPaymentReportsHubPage() {
  await requireOrgContext('report:read')

  return (
    <AppLauncher
      eyebrow="Bill payments"
      title="Bill payment reports"
      subtitle="Money paid out, open bills, and what you still owe."
      apps={BILL_PAYMENT_REPORT_APPS}
      searchable
    />
  )
}
