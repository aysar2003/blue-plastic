import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { NamedReportList } from '@/components/reports/named-report-list'
import { ReportCentreTabs } from '@/components/reports/report-centre-tabs'
import { PERFORMANCE_REPORTS } from '@/lib/standard-reports'

export const metadata: Metadata = { title: 'Performance centre' }

export default function PerformanceReportsPage() {
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
