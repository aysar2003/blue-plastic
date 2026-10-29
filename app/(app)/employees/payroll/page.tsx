import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'
import * as payrollService from '@/server/services/payroll.service'
import { PayrollBoard } from './payroll-board'

export const metadata: Metadata = { title: 'Payroll' }

export default async function PayrollPage() {
  const ctx = await requireOrgContext('hr:payroll')
  const [runs, accounts] = await Promise.all([
    payrollService.listRuns(ctx),
    payrollService.listPayAccounts(ctx),
  ])

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Draft payslips from wages, then post to the ledger."
      />
      <PayrollBoard
        runs={runs}
        accounts={accounts}
        canManage={ctx.permissions.has('hr:payroll')}
      />
    </>
  )
}
