import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate, toCalendarDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { createBudget } from './actions'

export const metadata: Metadata = { title: 'Budgets' }

export default async function BudgetsPage() {
  const ctx = await requireOrgContext('report:read')
  const budgets = await db.budget.findMany({
    where: { orgId: ctx.orgId },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      _count: { select: { lines: true } },
    },
    orderBy: { startDate: 'desc' },
  })

  return (
    <>
      <PageHeader
        organization={ctx.organization}
        title="Budgets"
        description="Plan income and expense amounts, then compare them on Budget vs Actual."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/reports/budget-vs-actual">Budget vs Actual</Link>
          </Button>
        }
      />

      <form action={createBudget} className="mb-8 grid max-w-xl gap-3 rounded-md border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required placeholder="FY 2026 operating" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="startDate">Start</Label>
            <Input id="startDate" name="startDate" type="date" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endDate">End</Label>
            <Input id="endDate" name="endDate" type="date" required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" name="notes" placeholder="Optional" />
        </div>
        <Button type="submit" className="w-fit">
          Create budget
        </Button>
      </form>

      {budgets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No budgets yet.</p>
      ) : (
        <ul className="divide-y rounded-md border bg-card">
          {budgets.map((budget) => (
            <li key={budget.id}>
              <Link
                href={`/accounting/budgets/${budget.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40"
              >
                <div>
                  <div className="font-medium">{budget.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(toCalendarDate(budget.startDate))} –{' '}
                    {formatDate(toCalendarDate(budget.endDate))}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">{budget._count.lines} lines</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
