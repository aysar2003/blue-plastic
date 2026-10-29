import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'
import * as hrBudgetService from '@/server/services/hr-budget.service'
import { BudgetList } from './budget-list'

export const metadata: Metadata = { title: 'HR budget' }

export default async function HrBudgetPage() {
  const ctx = await requireOrgContext('hr:read')
  const rows = await hrBudgetService.list(ctx)

  return (
    <>
      <PageHeader
        title="Budget"
        description="Yearly wage and headcount plan by month. Separate from Accounting → Budgets (ledger accounts)."
      />
      <BudgetList rows={rows} canManage={ctx.permissions.has('hr:update')} />
    </>
  )
}
