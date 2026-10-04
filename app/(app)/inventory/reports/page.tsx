import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { INVENTORY_REPORT_APPS } from '@/components/layout/module-hubs'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Inventory reports' }

export default async function InventoryReportsHubPage() {
  const ctx = await requireOrgContext('report:read')

  return (
    <AppLauncher
      eyebrow="Inventory"
      title="Inventory reports"
      subtitle="What is on hand, what it is worth, and what moved."
      apps={INVENTORY_REPORT_APPS}
      searchable
    />
  )
}
