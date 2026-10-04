import type { Metadata } from 'next'
import { AlertTriangleIcon, CheckCircle2Icon } from 'lucide-react'

import { PageHeader } from '@/components/data/page-header'
import { StatementTable } from '@/components/reports/statement-table'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { balanceSheet } from '@/server/reports/statements'
import { ReportControls } from '../report-controls'
import { readSettings, type SearchParams } from '../params'

export const metadata: Metadata = { title: 'Balance Sheet' }

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const settings = readSettings(query, ctx.organization)
  const currency = ctx.organization.baseCurrency

  const sheet = await balanceSheet(ctx.orgId, settings.asOf, { basis: settings.basis })

  // A balance sheet figure is a position, not a movement, so the detail behind
  // it runs from the beginning of the ledger to the statement date rather than
  // over the reporting period.
  const drill = (accountId: string) =>
    `/reports/transaction-detail?account=${accountId}&period=custom&from=1900-01-01&to=${settings.asOf}&back=/reports/balance-sheet`

  return (
    <>
      <PageHeader title="Balance Sheet" description={`As at ${formatDate(settings.asOf)}`} />

      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: 'asOf', basis: true, exportAs: 'balance-sheet' }}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <StatementTable
            sections={sheet.sections}
            currency={currency}
            drillTo={drill}
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
        </div>

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
