import type { Metadata } from 'next'
import { AlertTriangleIcon, CheckCircle2Icon } from 'lucide-react'

import { readSort } from '@/components/data/sortable-header'
import { PageHeader } from '@/components/data/page-header'
import { PrintButton } from '@/app/(app)/sales/[type]/[id]/print/print-button'
import { ReportEntityFilters } from '@/components/reports/report-entity-filters'
import { STATEMENT_SORT_COLUMNS, StatementTable } from '@/components/reports/statement-table'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import type { ReportFilterKind } from '@/server/reports/catalogue'
import { balanceSheet } from '@/server/reports/statements'
import { loadFilterOptions } from '../filter-options'
import { ReportControls } from '../report-controls'
import { readEntityFilters, readSettings, type SearchParams } from '../params'

const BS_FILTERS: ReportFilterKind[] = ['customer', 'vendor', 'item', 'account', 'store']

export const metadata: Metadata = { title: 'Balance Sheet' }

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const settings = readSettings(query, ctx.organization)
  const filters = readEntityFilters(query)
  const currency = ctx.organization.baseCurrency
  const sort = readSort(query, STATEMENT_SORT_COLUMNS, { sort: 'detail', dir: 'asc' })
  const linkParams = {
    period: settings.period,
    from: settings.range.from,
    to: settings.range.to,
    asOf: settings.asOf,
    basis: settings.basis,
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
    ...(filters.itemId ? { itemId: filters.itemId } : {}),
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    ...(filters.storeId ? { storeId: filters.storeId } : {}),
  }
  const filtered = Boolean(
    filters.customerId || filters.vendorId || filters.itemId || filters.accountId || filters.storeId,
  )

  const [sheet, filterOptions] = await Promise.all([
    balanceSheet(ctx.orgId, settings.asOf, { basis: settings.basis, filters }),
    loadFilterOptions(ctx.orgId, BS_FILTERS),
  ])

  // A balance sheet figure is a position, not a movement, so the detail behind
  // it runs from the beginning of the ledger to the statement date rather than
  // over the reporting period.
  const drill = (accountId: string) =>
    `/reports/transaction-detail?account=${accountId}&period=custom&from=1900-01-01&to=${settings.asOf}&back=/reports/balance-sheet`

  return (
    <>
      <PageHeader
        organization={ctx.organization}
        title="Balance Sheet"
        description={`As at ${formatDate(settings.asOf)}`}
        actions={
          <PrintButton
            paper="balance sheet"
            defaultSubject={`Balance Sheet — ${ctx.organization.name}`}
            defaultBody={`Balance Sheet\n${ctx.organization.name}\nAs at ${formatDate(settings.asOf)}`}
          />
        }
      />

      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: 'range', basis: true, exportAs: 'balance-sheet' }}
      />

      <ReportEntityFilters kinds={BS_FILTERS} values={filters} options={filterOptions} />
      {filtered ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Showing only journals that match the filters above. A filtered balance sheet may not
          balance — clear the filters for the full company position.
        </p>
      ) : null}

      <Card className="overflow-hidden p-0">
        <StatementTable
            sections={sheet.sections}
            currency={currency}
            drillTo={drill}
            sort={sort}
            basePath="/reports/balance-sheet"
            linkParams={linkParams}
            subtotals={{
              fixedAssets: [{ label: 'Total assets', amount: sheet.totalAssets, emphasis: true }],
              longTermLiabilities: [{ label: 'Total liabilities', amount: sheet.totalLiabilities }],
              equity: [
                // Shown as its own line because it is not posted anywhere: it is
                // the profit sitting in the nominal accounts until the year is
                // closed. Hiding it inside equity is what makes people think a
                // balance sheet is arbitrary.
                { label: 'Profit not yet closed to retained earnings', amount: sheet.accumulatedProfit },
                { label: 'Total equity', amount: sheet.totalEquity, emphasis: true },
              ],
            }}
          />

        <div
          className={`flex items-center gap-2 border-t px-3 py-2.5 text-sm ${
            sheet.balanced ? 'text-success' : 'text-destructive'
          }`}
        >
          {sheet.balanced ? (
            <>
              <CheckCircle2Icon className="size-4 shrink-0" />
              <span>
                Assets <strong className="tabular">{formatMoney(sheet.totalAssets, currency)}</strong> equal liabilities
                and equity. The sheet balances.
              </span>
            </>
          ) : (
            <>
              <AlertTriangleIcon className="size-4 shrink-0" />
              <span>
                Out of balance by{' '}
                <strong className="tabular">{formatMoney(sheet.difference.abs(), currency)}</strong>. This should be
                impossible — report it before relying on any other figure.
              </span>
            </>
          )}
        </div>
      </Card>
    </>
  )
}
