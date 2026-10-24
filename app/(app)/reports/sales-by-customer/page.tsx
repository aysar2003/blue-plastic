import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { readSort } from '@/components/data/sortable-header'
import { RankedTable } from '@/components/reports/ranked-table'
import { ReportEntityFilters } from '@/components/reports/report-entity-filters'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { salesByCustomer } from '@/server/reports/business'
import { loadFilterOptions } from '../filter-options'
import { ReportControls } from '../report-controls'
import {
  readEntityFilters,
  readSettings,
  settingsToQueryObject,
  type SearchParams,
} from '../params'

const SORTABLE = ['name', 'count', 'quantity', 'amount'] as const
const FILTERS = ['customer'] as const

export const metadata: Metadata = { title: 'Sales by Customer Summary' }

export default async function SalesByCustomerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const settings = readSettings(query, ctx.organization)
  const filters = readEntityFilters(query)
  const sort = readSort(query, SORTABLE, { sort: 'amount', dir: 'desc' })
  const linkParams = {
    ...settingsToQueryObject(settings),
    sort: sort.sort,
    dir: sort.dir,
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
  }

  const [report, filterOptions] = await Promise.all([
    salesByCustomer(ctx.orgId, settings.range, { customerId: filters.customerId }),
    loadFilterOptions(ctx.orgId, [...FILTERS]),
  ])

  return (
    <>
      <PageHeader
        organization={ctx.organization}
        title="Sales by Customer Summary"
        description={`${formatDate(settings.range.from)} to ${formatDate(settings.range.to)} · net of tax`}
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

      <ReportEntityFilters kinds={[...FILTERS]} values={filters} options={filterOptions} />

      <Card className="overflow-hidden p-0">
        <RankedTable
          sort={sort}
          basePath="/reports/sales-by-customer"
          linkParams={linkParams}
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
      </Card>
    </>
  )
}
