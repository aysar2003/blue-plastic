import type { Metadata } from 'next'

import { ACCOUNTING_REPORT_APPS } from '@/components/layout/module-hubs'
import { ModuleReportList } from '@/components/reports/module-report-list'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Accounting reports' }

export default async function AccountingReportsHubPage() {
  await requireOrgContext('report:read')

  return (
    <ModuleReportList
      eyebrow="Accounting"
      title="Accounting reports"
      subtitle="The ledger, account by account, and the papers behind a close."
      apps={ACCOUNTING_REPORT_APPS}
    />
  )
}
