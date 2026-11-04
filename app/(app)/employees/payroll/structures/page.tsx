import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'
import * as payrollService from '@/server/services/payroll.service'
import * as standardPayroll from '@/server/services/payroll-standard.service'
import { StructuresBoard } from './structures-board'

export const metadata: Metadata = { title: 'Salary structures' }

export default async function SalaryStructuresPage() {
  const ctx = await requireOrgContext('hr:payroll')
  const [structures, accounts] = await Promise.all([
    standardPayroll.listStructures(ctx),
    payrollService.listPayAccounts(ctx),
  ])
  return (
    <>
      <PageHeader title="Salary structures" description="Basic, allowances, deductions, and employer cost." />
      <StructuresBoard structures={structures} accounts={accounts} canManage={ctx.permissions.has('hr:payroll')} />
    </>
  )
}
