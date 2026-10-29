import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/server/auth/context'
import * as hrBudgetService from '@/server/services/hr-budget.service'
import { BudgetDetail } from './budget-detail'

export const metadata: Metadata = { title: 'HR budget year' }

export default async function HrBudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext('hr:read')
  const { id } = await params
  const budget = await hrBudgetService.get(ctx, id).catch(() => null)
  if (!budget) notFound()

  return (
    <>
      <PageHeader
        title={`${budget.year} — ${budget.name}`}
        description="Edit planned wage totals and headcount for each month."
        actions={
          <Button asChild type="button" size="sm" variant="outline">
            <Link href="/employees/budget">All budgets</Link>
          </Button>
        }
      />
      <BudgetDetail
        budgetId={budget.id}
        months={budget.months}
        canManage={ctx.permissions.has('hr:update')}
      />
    </>
  )
}
