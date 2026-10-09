import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { NamedReportList } from '@/components/reports/named-report-list'
import { ReportCentreTabs } from '@/components/reports/report-centre-tabs'
import { withoutBusinessOverview } from '@/lib/business-overview-access'
import { MANAGEMENT_REPORTS } from '@/lib/standard-reports'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Management reports' }

export default async function ManagementReportsPage() {
  const ctx = await requireOrgContext('report:read')
  return (
    <>
      <ReportCentreTabs active="management" />
      <PageHeader
        title="Management reports"
        description="The statements used to run the business. Each figure is read from the ledger."
      />
      <NamedReportList reports={withoutBusinessOverview(MANAGEMENT_REPORTS, ctx.permissions)} />
    </>
  )
}
