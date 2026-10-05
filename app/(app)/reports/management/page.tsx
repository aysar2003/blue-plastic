import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { NamedReportList } from '@/components/reports/named-report-list'
import { ReportCentreTabs } from '@/components/reports/report-centre-tabs'
import { MANAGEMENT_REPORTS } from '@/lib/standard-reports'

export const metadata: Metadata = { title: 'Management reports' }

export default function ManagementReportsPage() {
  return (
    <>
      <ReportCentreTabs active="management" />
      <PageHeader
        title="Management reports"
        description="The statements used to run the business. Each figure is read from the ledger."
      />
      <NamedReportList reports={MANAGEMENT_REPORTS} />
    </>
  )
}
