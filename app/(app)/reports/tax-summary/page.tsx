import type { Metadata } from 'next'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { readSort, SortableHeader } from '@/components/data/sortable-header'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { taxSummary } from '@/server/reports/business'
import { ReportControls } from '../report-controls'
import { readSettings, settingsToQueryObject, type SearchParams } from '../params'

const SORTABLE = ['rate', 'agency', 'salesNet', 'salesTax', 'purchaseNet', 'purchaseTax', 'net'] as const

export const metadata: Metadata = { title: 'Sales Tax Liability' }

export default async function TaxSummaryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const settings = readSettings(query, ctx.organization, 'this-quarter')
  const currency = ctx.organization.baseCurrency

  const report = await taxSummary(ctx.orgId, settings.range)

  const sort = readSort(query, SORTABLE, { sort: 'agency', dir: 'asc' })
  const linkParams = { ...settingsToQueryObject(settings), sort: sort.sort, dir: sort.dir }
  const direction = sort.dir === 'asc' ? 1 : -1
  const rows = [...report.rows].sort((a, b) => {
    switch (sort.sort) {
      case 'rate':
        return direction * a.rateName.localeCompare(b.rateName)
      case 'salesNet':
        return direction * a.salesNet.comparedTo(b.salesNet)
      case 'salesTax':
        return direction * a.salesTax.comparedTo(b.salesTax)
      case 'purchaseNet':
        return direction * a.purchaseNet.comparedTo(b.purchaseNet)
      case 'purchaseTax':
        return direction * a.purchaseTax.comparedTo(b.purchaseTax)
      case 'net':
        return direction * a.net.comparedTo(b.net)
      default:
        return direction * a.agencyName.localeCompare(b.agencyName) || a.rateName.localeCompare(b.rateName)
    }
  })

  return (
    <>
      <PageHeader
        title="Sales Tax Liability"
        description={`${formatDate(settings.range.from)} to ${formatDate(settings.range.to)} · what is owed to each agency`}
      />

      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: 'range', exportAs: 'tax-summary' }}
      />

      {report.rows.length === 0 ? (
        <EmptyState
          title="No taxable activity"
          description="Nothing in this period carried a tax code. Tax codes are set up under Settings → Tax."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader column="rate" label="Rate" state={sort} basePath="/reports/tax-summary" params={linkParams} />
                  <SortableHeader column="agency" label="Agency" state={sort} basePath="/reports/tax-summary" params={linkParams} />
                  <TableHead className="numeric w-20">Rate</TableHead>
                  <SortableHeader column="salesNet" label="Taxable sales" state={sort} basePath="/reports/tax-summary" params={linkParams} className="w-36" numeric defaultDirection="desc" />
                  <SortableHeader column="salesTax" label="Tax on sales" state={sort} basePath="/reports/tax-summary" params={linkParams} className="w-36" numeric defaultDirection="desc" />
                  <SortableHeader column="purchaseNet" label="Taxable purchases" state={sort} basePath="/reports/tax-summary" params={linkParams} className="w-36" numeric defaultDirection="desc" />
                  <SortableHeader column="purchaseTax" label="Tax on purchases" state={sort} basePath="/reports/tax-summary" params={linkParams} className="w-36" numeric defaultDirection="desc" />
                  <SortableHeader column="net" label="Net owed" state={sort} basePath="/reports/tax-summary" params={linkParams} className="w-36" numeric defaultDirection="desc" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.rateId}>
                    <TableCell className="font-medium">{row.rateName}</TableCell>
                    <TableCell className="text-muted-foreground">{row.agencyName}</TableCell>
                    <TableCell className="numeric tabular text-muted-foreground">
                      {row.ratePercent.toDecimalPlaces(3).toString()}%
                    </TableCell>
                    <TableCell className="numeric tabular">{formatMoney(row.salesNet, currency)}</TableCell>
                    <TableCell className="numeric tabular">{formatMoney(row.salesTax, currency)}</TableCell>
                    <TableCell className="numeric tabular">{formatMoney(row.purchaseNet, currency)}</TableCell>
                    <TableCell className="numeric tabular">{formatMoney(row.purchaseTax, currency)}</TableCell>
                    <TableCell className="numeric tabular font-medium">{formatMoney(row.net, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={7} className="font-semibold">
                    Net owed to tax agencies
                  </TableCell>
                  <TableCell className="numeric tabular font-semibold">
                    {formatMoney(report.totalNet, currency)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          <p className="border-t px-3 py-2.5 text-sm text-muted-foreground">
            Split rate by rate from the document lines, because a return is filed per rate and a single Sales Tax
            Payable balance cannot be separated again once several rates have been posted to it.
          </p>
        </Card>
      )}
    </>
  )
}
