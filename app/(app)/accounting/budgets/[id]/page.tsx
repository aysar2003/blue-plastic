import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { formatDate, toCalendarDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { deleteBudgetLine, upsertBudgetLine } from '../actions'

export const metadata: Metadata = { title: 'Budget' }

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireOrgContext('report:read')
  const budget = await db.budget.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      notes: true,
      lines: {
        select: {
          id: true,
          amount: true,
          account: { select: { code: true, name: true } },
        },
        orderBy: { account: { code: 'asc' } },
      },
    },
  })
  if (!budget) notFound()

  const accounts = await db.ledgerAccount.findMany({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      type: { in: ['REVENUE', 'COGS', 'EXPENSE'] },
    },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  })

  return (
    <>
      <PageHeader
        organization={ctx.organization}
        title={budget.name}
        description={`${formatDate(toCalendarDate(budget.startDate))} to ${formatDate(
          toCalendarDate(budget.endDate),
        )}${budget.notes ? ` — ${budget.notes}` : ''}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/reports/budget-vs-actual?period=custom&from=${toCalendarDate(budget.startDate)}&to=${toCalendarDate(budget.endDate)}`}
            >
              Budget vs Actual
            </Link>
          </Button>
        }
      />

      <form action={upsertBudgetLine} className="mb-6 flex flex-wrap items-end gap-3 rounded-md border bg-card p-4">
        <input type="hidden" name="budgetId" value={budget.id} />
        <div className="space-y-1.5">
          <Label htmlFor="accountId">Account</Label>
          <NativeSelect id="accountId" name="accountId" className="w-72" required defaultValue="">
            <option value="" disabled>
              Choose account
            </option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} {account.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" name="amount" required className="w-40" placeholder="0.00" />
        </div>
        <Button type="submit">Save line</Button>
      </form>

      {budget.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No lines yet. Add revenue and expense accounts above.</p>
      ) : (
        <table className="w-full max-w-3xl border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Account</th>
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
                <td className="py-2 pr-4">
                  {formatMoney(line.amount.toString(), ctx.organization.baseCurrency)}
                </td>
                <td className="py-2">
                  <form action={deleteBudgetLine}>
                    <input type="hidden" name="lineId" value={line.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Remove
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
