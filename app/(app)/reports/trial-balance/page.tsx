import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangleIcon, CheckCircle2Icon } from 'lucide-react'

import { PageHeader } from '@/components/data/page-header'
import { ClickableRow } from '@/components/reports/clickable-row'
import { readSort, SortableHeader } from '@/components/data/sortable-header'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from '@/components/ui/table'
import { ACCOUNT_TYPE_LABELS } from '@/lib/accounting-labels'
import { fiscalYearOf, fiscalYearRange, formatDate, today } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { trialBalance } from '@/server/accounting/balances'
import { requireOrgContext } from '@/server/auth/context'
import { DateRangeForm } from './date-range-form'

export const metadata: Metadata = { title: 'Trial Balance' }

const SORTABLE = ['code', 'name', 'type', 'debit', 'credit'] as const

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

  // Sorted here: a trial balance is read in account order by default, but "which
  // account carries the biggest balance" is the other question people ask of it.
  const sort = readSort(query, SORTABLE, { sort: 'code', dir: 'asc' })
  const linkParams = { from, to, sort: sort.sort, dir: sort.dir }
  const direction = sort.dir === 'asc' ? 1 : -1
  const rows = [...report.rows].sort((a, b) => {
    switch (sort.sort) {
      case 'name':
        return direction * a.name.localeCompare(b.name)
      case 'type':
        return direction * a.type.localeCompare(b.type) || a.code.localeCompare(b.code)
      case 'debit':
        return direction * a.closingDebit.comparedTo(b.closingDebit)
      case 'credit':
        return direction * a.closingCredit.comparedTo(b.closingCredit)
      default:
        return direction * a.code.localeCompare(b.code)
    }
  })
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="Trial Balance"
        description={`Every account with a balance or movement between ${formatDate(from)} and ${formatDate(to)}.`}
      />

      <div className="mb-4">
        <DateRangeForm from={from} to={to} />
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader column="code" label="Number" state={sort} basePath="/reports/trial-balance" params={linkParams} className="w-24" />
              <SortableHeader column="name" label="Account" state={sort} basePath="/reports/trial-balance" params={linkParams} />
              <SortableHeader column="type" label="Type" state={sort} basePath="/reports/trial-balance" params={linkParams} />
              <SortableHeader column="debit" label="Debit" state={sort} basePath="/reports/trial-balance" params={linkParams} className="w-36" numeric defaultDirection="desc" />
              <SortableHeader column="credit" label="Credit" state={sort} basePath="/reports/trial-balance" params={linkParams} className="w-36" numeric defaultDirection="desc" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Nothing has been posted in this period.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const href = `/reports/transaction-detail?account=${row.accountId}&period=custom&from=${from}&to=${to}&back=/reports/trial-balance`
                return (
                <ClickableRow key={row.accountId} href={href}>
                  <TableCell className="tabular text-muted-foreground">{row.code}</TableCell>
                  <TableCell>
                    <Link href={href} className="font-medium underline-offset-4 hover:underline">
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{ACCOUNT_TYPE_LABELS[row.type]}</TableCell>
                  <TableCell className="numeric tabular">
                    {row.closingDebit.isZero() ? '' : (
                      <Link href={href} className="underline-offset-4 hover:underline">
                        {formatMoney(row.closingDebit, currency)}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="numeric tabular">
                    {row.closingCredit.isZero() ? '' : (
                      <Link href={href} className="underline-offset-4 hover:underline">
                        {formatMoney(row.closingCredit, currency)}
                      </Link>
                    )}
                  </TableCell>
                </ClickableRow>
                )
              })
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="font-semibold">
                Totals
              </TableCell>
              <TableCell className="numeric tabular font-semibold">
                {formatMoney(report.totalDebit, currency)}
              </TableCell>
              <TableCell className="numeric tabular font-semibold">
                {formatMoney(report.totalCredit, currency)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>

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
