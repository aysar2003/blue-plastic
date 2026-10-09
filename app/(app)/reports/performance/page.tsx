import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { NamedReportList } from '@/components/reports/named-report-list'
import { ReportCentreTabs } from '@/components/reports/report-centre-tabs'
import { PERFORMANCE_REPORTS } from '@/lib/standard-reports'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Performance centre' }

export default async function PerformanceReportsPage() {
  await requireOrgContext('report:read')
  return (
    <>
      <ReportCentreTabs active="performance" />
      <PageHeader
        title="Performance centre"
        description="Who did the work, and which customers, vendors, and products moved the numbers."
      />
      <NamedReportList reports={PERFORMANCE_REPORTS} />
    </>
  )
}
