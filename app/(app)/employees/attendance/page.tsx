import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as attendanceService from '@/server/services/attendance.service'
import * as employeeService from '@/server/services/employee.service'
import { AttendanceBoard } from './attendance-board'

export const metadata: Metadata = { title: 'Attendance' }

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('hr:attendance')
  const params = await searchParams
  const to = typeof params.to === 'string' ? params.to : today()
  const from =
    typeof params.from === 'string'
      ? params.from
      : (() => {
          const d = new Date(`${to}T00:00:00.000Z`)
          d.setUTCDate(d.getUTCDate() - 14)
          return d.toISOString().slice(0, 10)
        })()

  const [rows, employees] = await Promise.all([
    attendanceService.list(ctx, { from, to }),
    employeeService.list(ctx, { active: true }),
  ])

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Daily check-in / check-out or hours worked."
        actions={
          <Button asChild type="button" size="sm" variant="outline">
            <Link href="/employees/attendance/devices">Devices</Link>
          </Button>
        }
      />
      <AttendanceBoard
        rows={rows}
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
        from={from}
        to={to}
        canManage={ctx.permissions.has('hr:attendance')}
      />
    </>
  )
}
