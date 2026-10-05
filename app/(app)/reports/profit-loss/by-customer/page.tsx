import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { RankedTable } from '@/components/reports/ranked-table'
import { Card } from '@/components/ui/card'
import { readSort } from '@/components/data/sortable-header'
import { formatDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { salesByCustomer } from '@/server/reports/business'
import { ReportControls } from '../../report-controls'
import { readSettings, settingsToQueryObject, type SearchParams } from '../../params'

export const metadata: Metadata = { title: 'Profit and Loss by Customer' }

const SORTABLE = ['name', 'count', 'amount'] as const

export default async function ProfitAndLossByCustomerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const settings = readSettings(query, ctx.organization)
  const sort = readSort(query, SORTABLE, { sort: 'amount', dir: 'desc' })
  const report = await salesByCustomer(ctx.orgId, settings.range)

  return (
    <>
      <PageHeader
        title="Profit and Loss by Customer"
        description={`${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}. Income net of tax, by customer. Cost of goods is not kept per customer, so this is the income side of the profit and loss.`}
      />
      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: 'range', exportAs: 'sales-by-customer' }}
      />
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <RankedTable
            sort={sort}
            basePath="/reports/profit-loss/by-customer"
            linkParams={{ ...settingsToQueryObject(settings), sort: sort.sort, dir: sort.dir }}
            rows={report.rows}
            total={report.total}
            currency={ctx.organization.baseCurrency}
            nameHeader="Customer"
            countHeader="Documents"
            linkTo={(id) =>
              `/reports/statements/customer?customerId=${id}&view=detail&period=custom&from=${settings.range.from}&to=${settings.range.to}`
            }
            empty="No sales were recorded in this period."
          />
        </div>
      </Card>
    </>
  )
}
