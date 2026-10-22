import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { BANKING_REPORT_APPS } from '@/components/layout/module-hubs'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Banking reports' }

export default async function BankingReportsHubPage() {
  await requireOrgContext('report:read')

  return (
    <AppLauncher
      eyebrow="Banking"
      title="Banking reports"
      subtitle="Deposits, transfers, and where the cash sat."
      apps={BANKING_REPORT_APPS}
      searchable
    />
  )
}
