import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { readSort } from '@/components/data/sortable-header'
import { RankedTable } from '@/components/reports/ranked-table'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { expensesByCategory } from '@/server/reports/business'
import { ReportControls } from '../report-controls'
import { readSettings, settingsToQueryObject, type SearchParams } from '../params'

const SORTABLE = ['name', 'count', 'quantity', 'amount'] as const

export const metadata: Metadata = { title: 'Expenses by Account' }

export default async function ExpensesByCategoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const settings = readSettings(query, ctx.organization)
  const sort = readSort(query, SORTABLE, { sort: 'amount', dir: 'desc' })
  const linkParams = { ...settingsToQueryObject(settings), sort: sort.sort, dir: sort.dir }

  const report = await expensesByCategory(ctx.orgId, settings.range)

  return (
    <>
      <PageHeader
        title="Expenses by Account"
        description={`${formatDate(settings.range.from)} to ${formatDate(settings.range.to)} · from the ledger, however it was entered`}
      />

      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: 'range', exportAs: 'expenses-by-category' }}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <RankedTable
            sort={sort}
            basePath="/reports/expenses-by-category"
            linkParams={linkParams}
            rows={report.rows}
            total={report.total}
            currency={ctx.organization.baseCurrency}
            nameHeader="Account"
            countHeader="Entries"
            linkTo={(id) =>
              `/reports/transaction-detail?account=${id}&period=custom&from=${settings.range.from}&to=${settings.range.to}&back=/reports/expenses-by-category`
            }
            empty="No expenses were recorded in this period."
          />
        </div>
      </Card>
    </>
  )
}
