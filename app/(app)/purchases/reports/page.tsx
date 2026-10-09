import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { PURCHASE_REPORT_APPS } from '@/components/layout/module-hubs'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Purchase reports' }

export default async function PurchaseReportsHubPage() {
  await requireOrgContext('report:read')

  return (
    <AppLauncher
      eyebrow="Purchases"
      title="Purchase reports"
      subtitle="What you bought, who you owe, and where the spending goes."
      apps={PURCHASE_REPORT_APPS}
      searchable
    />
  )
}
