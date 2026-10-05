import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { FavouriteReports } from '@/components/reports/favourite-reports'
import { ReportCentreTabs } from '@/components/reports/report-centre-tabs'
import { STANDARD_FAVOURITES } from '@/lib/standard-reports'

export const metadata: Metadata = { title: 'Custom reports' }

export default function CustomReportsPage() {
  return (
    <>
      <ReportCentreTabs active="custom" />
      <PageHeader
        title="Custom reports"
        description="Star a standard report to keep it here. This is a saved favourite, not a second report engine."
      />
      <FavouriteReports reports={STANDARD_FAVOURITES} />
    </>
  )
}
