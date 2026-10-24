import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { readSort } from '@/components/data/sortable-header'
import { RankedTable } from '@/components/reports/ranked-table'
import { ReportEntityFilters } from '@/components/reports/report-entity-filters'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { purchasesByVendor } from '@/server/reports/business'
import { loadFilterOptions } from '../filter-options'
import { ReportControls } from '../report-controls'
import {
  readEntityFilters,
  readSettings,
  settingsToQueryObject,
  type SearchParams,
} from '../params'

const SORTABLE = ['name', 'count', 'quantity', 'amount'] as const
const FILTERS = ['vendor'] as const

export const metadata: Metadata = { title: 'Purchases by Vendor Summary' }

export default async function PurchasesByVendorPage({
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
    ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
  }

  const [report, filterOptions] = await Promise.all([
    purchasesByVendor(ctx.orgId, settings.range, { vendorId: filters.vendorId }),
    loadFilterOptions(ctx.orgId, [...FILTERS]),
  ])

  return (
    <>
      <PageHeader
        organization={ctx.organization}
        title="Purchases by Vendor Summary"
        description={`${formatDate(settings.range.from)} to ${formatDate(settings.range.to)} · net of tax`}
      />

      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: 'range', exportAs: 'purchases-by-vendor' }}
      />

      <ReportEntityFilters kinds={[...FILTERS]} values={filters} options={filterOptions} />

      <Card className="overflow-hidden p-0">
        <RankedTable
          sort={sort}
          basePath="/reports/purchases-by-vendor"
          linkParams={linkParams}
          rows={report.rows}
          total={report.total}
          currency={ctx.organization.baseCurrency}
          nameHeader="Vendor"
          countHeader="Documents"
          linkTo={(id) =>
            `/reports/statements/vendor?vendorId=${id}&period=custom&from=${settings.range.from}&to=${settings.range.to}`
          }
          empty="Nothing was bought in this period."
        />
      </Card>
    </>
  )
}
