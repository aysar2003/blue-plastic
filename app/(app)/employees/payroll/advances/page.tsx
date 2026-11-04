import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'
import * as payrollService from '@/server/services/payroll.service'
import * as standardPayroll from '@/server/services/payroll-standard.service'
import { AdvancesBoard } from './advances-board'

export const metadata: Metadata = { title: 'Loans and advances' }

export default async function AdvancesPage() {
  const ctx = await requireOrgContext('hr:payroll')
  const [rows, people, accounts] = await Promise.all([
    standardPayroll.listAdvances(ctx),
    standardPayroll.listPeople(ctx),
    payrollService.listPayAccounts(ctx),
  ])
  return (
    <>
      <PageHeader
        title="Loans and advances"
        description="Each payroll recovers the installment until the balance is zero."
      />
      <AdvancesBoard
        rows={rows}
        people={people}
        accounts={accounts}
        canManage={ctx.permissions.has('hr:payroll')}
      />
    </>
  )
}
