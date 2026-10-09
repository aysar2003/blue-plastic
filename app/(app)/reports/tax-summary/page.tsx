import type { Metadata } from 'next'

import { EmptyState } from '@/components/data/empty-state'
import { InteractiveGrid } from '@/components/data/interactive-grid'
import { PageHeader } from '@/components/data/page-header'
import { formatDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { taxSummary } from '@/server/reports/business'
import { ReportControls } from '../report-controls'
import { readSettings, type SearchParams } from '../params'

export const metadata: Metadata = { title: 'Sales Tax Liability' }

export default async function TaxSummaryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const settings = readSettings(query, ctx.organization, 'this-quarter')
  const currency = ctx.organization.baseCurrency

  const report = await taxSummary(ctx.orgId, settings.range)

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
        <>
        <InteractiveGrid
          storageKey="bp-tax-summary"
          currency={currency}
          customizable
          initialSort={{ id: 'agency', dir: 'asc' }}
          columns={[
            { id: 'rate', label: 'Rate', defaultWidth: 180 },
            { id: 'agency', label: 'Agency', defaultWidth: 180 },
            { id: 'percent', label: 'Rate', total: false, defaultWidth: 96 },
            { id: 'salesNet', label: 'Taxable sales', kind: 'money', total: true, defaultWidth: 144 },
            { id: 'salesTax', label: 'Tax on sales', kind: 'money', total: true, defaultWidth: 144 },
            { id: 'purchaseNet', label: 'Taxable purchases', kind: 'money', total: true, defaultWidth: 160 },
            { id: 'purchaseTax', label: 'Tax on purchases', kind: 'money', total: true, defaultWidth: 160 },
            { id: 'net', label: 'Net owed', kind: 'money', total: true, defaultWidth: 144 },
          ]}
          rows={report.rows.map((row) => ({
            id: row.rateId,
            cells: {
              rate: { value: row.rateName },
              agency: { value: row.agencyName },
              percent: {
                value: `${row.ratePercent.toDecimalPlaces(3).toString()}%`,
                sort: row.ratePercent.toFixed(4).padStart(12, '0'),
              },
              salesNet: { value: row.salesNet.toString() },
              salesTax: { value: row.salesTax.toString() },
              purchaseNet: { value: row.purchaseNet.toString() },
              purchaseTax: { value: row.purchaseTax.toString() },
              net: { value: row.net.toString() },
            },
          }))}
        />

        <p className="mt-3 text-sm text-muted-foreground">
          Split rate by rate from the document lines, because a return is filed per rate and a single Sales Tax
          Payable balance cannot be separated again once several rates have been posted to it.
        </p>
        </>
      )}
    </>
  )
}
