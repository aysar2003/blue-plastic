import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'
import * as employeeService from '@/server/services/employee.service'
import * as leaveService from '@/server/services/leave.service'
import { LeaveBoard } from './leave-board'

export const metadata: Metadata = { title: 'Leave' }

export default async function LeavePage() {
  const ctx = await requireOrgContext('hr:leave')
  const year = new Date().getFullYear()
  const [types, allocations, requests, employees] = await Promise.all([
    leaveService.listTypes(ctx),
    leaveService.listAllocations(ctx, year),
    leaveService.listRequests(ctx),
    employeeService.list(ctx, { active: true }),
  ])

  return (
    <>
      <PageHeader
        title="Leave"
        description="Leave types, yearly allocations, requests, and approvals."
      />
      <LeaveBoard
        types={types.map((t) => ({
          id: t.id,
          name: t.name,
          paid: t.paid,
          daysPerYear: t.daysPerYear.toFixed(4),
          active: t.active,
        }))}
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
        allocations={allocations.map((a) => ({
          id: a.id,
          employeeName: a.employee.name,
          leaveTypeName: a.leaveType.name,
          year: a.year,
          entitledDays: a.entitledDays.toFixed(4),
        }))}
        requests={requests}
        year={year}
        canManage={ctx.permissions.has('hr:leave')}
      />
    </>
  )
}
