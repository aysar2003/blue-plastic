import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { NamedReportList } from '@/components/reports/named-report-list'
import { ReportCentreTabs } from '@/components/reports/report-centre-tabs'
import { SPREADSHEET_EXPORTS } from '@/lib/standard-reports'

export const metadata: Metadata = { title: 'Spreadsheet sync' }

export default function SpreadsheetReportsPage() {
  return (
    <>
      <ReportCentreTabs active="spreadsheet" />
      <PageHeader
        title="Spreadsheet sync"
        description="Download a CSV of a report that already exists, then open it in a spreadsheet."
      />
      <NamedReportList reports={SPREADSHEET_EXPORTS} />
    </>
  )
}
