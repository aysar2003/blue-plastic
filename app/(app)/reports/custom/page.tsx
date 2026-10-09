import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { FavouriteReports } from '@/components/reports/favourite-reports'
import { ReportCentreTabs } from '@/components/reports/report-centre-tabs'
import { withoutBusinessOverview } from '@/lib/business-overview-access'
import { STANDARD_FAVOURITES } from '@/lib/standard-reports'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Custom reports' }

export default async function CustomReportsPage() {
  const ctx = await requireOrgContext('report:read')
  return (
    <>
      <ReportCentreTabs active="custom" />
      <PageHeader
        title="Custom reports"
        description="Star a standard report to keep it here. This is a saved favourite, not a second report engine."
      />
      <FavouriteReports reports={withoutBusinessOverview(STANDARD_FAVOURITES, ctx.permissions)} />
    </>
  )
}
