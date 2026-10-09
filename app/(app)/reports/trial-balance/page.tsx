import type { Metadata } from 'next'
import { AlertTriangleIcon, CheckCircle2Icon } from 'lucide-react'

import { InteractiveGrid } from '@/components/data/interactive-grid'
import { PageHeader } from '@/components/data/page-header'
import { PrintButton } from '@/app/(app)/sales/[type]/[id]/print/print-button'
import { Card } from '@/components/ui/card'
import { ACCOUNT_TYPE_LABELS } from '@/lib/accounting-labels'
import { fiscalYearOf, fiscalYearRange, formatDate, today } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { trialBalance } from '@/server/accounting/balances'
import { requireOrgContext } from '@/server/auth/context'
import { DateRangeForm } from './date-range-form'

export const metadata: Metadata = { title: 'Trial Balance' }

/**
 * The trial balance is the ledger's own self-check: if total debits do not equal
 * total credits, something is wrong at a level no other report will reveal.
 * It is therefore stated plainly at the bottom rather than left to be inferred.
 */
export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams

  const defaults = fiscalYearRange(
    fiscalYearOf(today(ctx.organization.timeZone), ctx.organization.fiscalYearStartMonth),
    ctx.organization.fiscalYearStartMonth,
  )
  const from = typeof query.from === 'string' ? query.from : defaults.start
  const to = typeof query.to === 'string' ? query.to : defaults.end

  const report = await trialBalance(ctx.orgId, { from, to })

  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        className="print:hidden"
        title="Trial Balance"
        description={`Every account with a balance or movement between ${formatDate(from)} and ${formatDate(to)}.`}
        actions={
          <PrintButton
            paper="trial balance"
            defaultSubject={`Trial Balance — ${ctx.organization.name}`}
            defaultBody={`Trial Balance\n${ctx.organization.name}\n${formatDate(from)} to ${formatDate(to)}`}
          />
        }
      />

      <div className="mb-4">
        <DateRangeForm from={from} to={to} />
      </div>

      {report.rows.length === 0 ? (
        <div className="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">
          Nothing has been posted in this period.
        </div>
      ) : (
        <InteractiveGrid
          storageKey="bp-trial-balance"
          currency={currency}
          customizable
          showTotal={false}
          columns={[
            { id: 'code', label: 'Number', defaultWidth: 112 },
            { id: 'name', label: 'Account', defaultWidth: 240 },
            { id: 'type', label: 'Type', defaultWidth: 160 },
            { id: 'debit', label: 'Debit', kind: 'money', total: true, defaultWidth: 140 },
            { id: 'credit', label: 'Credit', kind: 'money', total: true, defaultWidth: 140 },
          ]}
          rows={report.rows.map((row) => {
            const href = `/reports/transaction-detail?account=${row.accountId}&period=custom&from=${from}&to=${to}&back=/reports/trial-balance`
            return {
              id: row.accountId,
              cells: {
                code: { value: row.code, href },
                name: { value: row.name, href },
                type: { value: ACCOUNT_TYPE_LABELS[row.type], href },
                debit: { value: row.closingDebit.isZero() ? null : row.closingDebit.toString(), href },
                credit: { value: row.closingCredit.isZero() ? null : row.closingCredit.toString(), href },
              },
            }
          })}
          footers={[
            {
              id: 'totals',
              label: 'Total',
              cells: {
                debit: { value: report.totalDebit.toString() },
                credit: { value: report.totalCredit.toString() },
              },
            },
          ]}
        />
      )}

      <Card className="mt-4 overflow-hidden p-0">
        <div
          className={`flex items-center gap-2 border-t px-3 py-2.5 text-sm ${
            report.balanced ? 'text-success' : 'text-destructive'
          }`}
        >
          {report.balanced ? (
            <>
              <CheckCircle2Icon className="size-4 shrink-0" />
              <span>Debits equal credits. The ledger is in balance.</span>
            </>
          ) : (
            <>
              <AlertTriangleIcon className="size-4 shrink-0" />
              <span>
                The ledger is out of balance by{' '}
                <strong className="tabular">
                  {formatMoney(report.totalDebit.minus(report.totalCredit).abs(), currency)}
                </strong>
                . This should be impossible — report it before relying on any other figure.
              </span>
            </>
          )}
        </div>
      </Card>
    </>
  )
}
