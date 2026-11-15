import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { formatDate, toCalendarDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { CreateBudgetForm } from './budget-forms'

export const metadata: Metadata = { title: 'Budgets' }

export default async function BudgetsPage() {
  const ctx = await requireOrgContext('report:read')
  const [budgets, classes] = await Promise.all([
    db.budget.findMany({
      where: { orgId: ctx.orgId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
        version: true,
        _count: { select: { lines: true } },
      },
      orderBy: [{ startDate: 'desc' }, { version: 'desc' }],
    }),
    db.trackingCategory.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <>
      <PageHeader
        organization={ctx.organization}
        title="Budgets"
        description="Yearly plan by month and class. Approve, then compare on Budget vs Actual."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/reports/budget-vs-actual">Budget vs Actual</Link>
          </Button>
        }
      />

      <CreateBudgetForm classes={classes} />

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
                  <div className="font-medium">
                    {budget.name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      v{budget.version} · {budget.status}
                    </span>
                  </div>
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
