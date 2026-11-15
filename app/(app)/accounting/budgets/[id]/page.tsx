import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { MONTHS } from '@/lib/constants'
import { formatDate, toCalendarDate } from '@/lib/date'
import { monthsInRange } from '@/lib/erp/budget-deep'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as budgetService from '@/server/services/budget.service'
import {
  BudgetToolbar,
  CopyBudgetForm,
  ImportBudgetCsvForm,
  RemoveLineButton,
  UpsertLineForm,
} from '../budget-forms'

export const metadata: Metadata = { title: 'Budget' }

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireOrgContext('report:read')
  let budget
  try {
    budget = await budgetService.get(ctx, id)
  } catch {
    notFound()
  }

  const months = monthsInRange(toCalendarDate(budget.startDate), toCalendarDate(budget.endDate))
  const canEdit = budget.status === 'DRAFT'

  const [accounts, classes] = await Promise.all([
    db.ledgerAccount.findMany({
      where: {
        orgId: ctx.orgId,
        isActive: true,
        type: { in: ['REVENUE', 'COGS', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY'] },
      },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    }),
    db.trackingCategory.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // Pivot: account+class → months
  type RowKey = string
  const grid = new Map<
    RowKey,
    {
      accountCode: string
      accountName: string
      className: string | null
      byMonth: Map<number, { id: string; amount: string }>
    }
  >()
  for (const line of budget.lines) {
    const key = `${line.accountId}|${line.trackingCategoryId ?? ''}`
    const row =
      grid.get(key) ??
      ({
        accountCode: line.account.code,
        accountName: line.account.name,
        className: line.trackingCategory?.name ?? null,
        byMonth: new Map(),
      } as const)
    const mutable = grid.get(key) ?? {
      accountCode: line.account.code,
      accountName: line.account.name,
      className: line.trackingCategory?.name ?? null,
      byMonth: new Map<number, { id: string; amount: string }>(),
    }
    mutable.byMonth.set(line.month, { id: line.id, amount: line.amount.toString() })
    grid.set(key, mutable)
    void row
  }

  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        organization={ctx.organization}
        title={budget.name}
        description={`${formatDate(toCalendarDate(budget.startDate))} to ${formatDate(
          toCalendarDate(budget.endDate),
        )} · ${budget.status} v${budget.version}${
          budget.trackingCategory ? ` · ${budget.trackingCategory.name}` : ''
        }${budget.notes ? ` — ${budget.notes}` : ''}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/reports/budget-vs-actual?period=custom&from=${toCalendarDate(budget.startDate)}&to=${toCalendarDate(budget.endDate)}&view=monthly`}
            >
              Budget vs Actual
            </Link>
          </Button>
        }
      />

      <BudgetToolbar budgetId={budget.id} status={budget.status} currency={currency} />

      <UpsertLineForm
        budgetId={budget.id}
        accounts={accounts}
        classes={classes}
        months={months}
        canEdit={canEdit}
      />

      {grid.size === 0 ? (
        <p className="mb-6 text-sm text-muted-foreground">
          No lines yet. Add P&amp;L or balance-sheet accounts by month above, or import CSV.
        </p>
      ) : (
        <div className="mb-8 overflow-x-auto rounded-md border">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium">Class</th>
                {months.map((m) => (
                  <th key={m} className="px-3 py-2 text-right font-medium">
                    {MONTHS[m - 1]?.slice(0, 3)}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {[...grid.entries()].map(([key, row]) => {
                let total = 0
                const cells = months.map((m) => {
                  const cell = row.byMonth.get(m)
                  if (cell) total += Number(cell.amount)
                  return cell
                })
                return (
                  <tr key={key} className="border-b">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.accountCode} {row.accountName}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.className ?? '—'}</td>
                    {cells.map((cell, i) => (
                      <td key={months[i]} className="px-3 py-2 text-right tabular-nums">
                        {cell ? formatMoney(cell.amount, currency) : '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatMoney(total.toFixed(4), currency)}
                    </td>
                    <td className="px-3 py-2">
                      {canEdit && cells[0] ? (
                        <RemoveLineButton lineId={cells.find((c) => c)?.id ?? ''} canEdit={canEdit} />
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Remove deletes one month cell via the first filled month&apos;s line — use Spread / Collapse
            for whole-row reshaping.
          </p>
        </div>
      )}

      {/* Per-line remove list for draft clarity */}
      {canEdit && budget.lines.length > 0 ? (
        <details className="mb-8">
          <summary className="cursor-pointer text-sm text-muted-foreground">All line cells</summary>
          <table className="mt-2 w-full max-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Account</th>
                <th className="py-2 pr-4 font-medium">Month</th>
                <th className="py-2 pr-4 font-medium">Class</th>
                <th className="py-2 pr-4 font-medium">Amount</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {budget.lines.map((line) => (
                <tr key={line.id} className="border-b">
                  <td className="py-2 pr-4">
                    {line.account.code} {line.account.name}
                  </td>
                  <td className="py-2 pr-4">{MONTHS[line.month - 1]}</td>
                  <td className="py-2 pr-4">{line.trackingCategory?.name ?? '—'}</td>
                  <td className="py-2 pr-4">
                    {formatMoney(line.amount.toString(), currency)}
                  </td>
                  <td className="py-2">
                    <RemoveLineButton lineId={line.id} canEdit={canEdit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}

      <CopyBudgetForm sourceId={budget.id} />
      <ImportBudgetCsvForm budgetId={budget.id} canEdit={canEdit} />
    </>
  )
}
