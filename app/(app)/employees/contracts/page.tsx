import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'
import * as employeeService from '@/server/services/employee.service'
import * as hrService from '@/server/services/employee-hr.service'
import { ContractsBoard } from './contracts-board'

export const metadata: Metadata = { title: 'Contracts' }

export default async function ContractsPage() {
  const ctx = await requireOrgContext('hr:read')
  const [contracts, employees] = await Promise.all([
    hrService.listContracts(ctx),
    employeeService.list(ctx, { active: true }),
  ])

  return (
    <>
      <PageHeader
        title="Contracts"
        description="Employment agreements — dates, wage, and signed PDF. Open a contract to sync wage onto the employee card for payroll."
      />
      <ContractsBoard
        contracts={contracts}
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
        canManage={ctx.permissions.has('hr:update')}
      />
    </>
  )
}
