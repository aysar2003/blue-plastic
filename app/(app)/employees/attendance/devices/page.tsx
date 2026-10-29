import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/server/auth/context'
import * as deviceService from '@/server/services/attendance-device.service'
import * as employeeService from '@/server/services/employee.service'
import { DevicesBoard } from './devices-board'

export const metadata: Metadata = { title: 'Attendance devices' }

export default async function AttendanceDevicesPage() {
  const ctx = await requireOrgContext('hr:attendance')
  const [devices, employees, punches] = await Promise.all([
    deviceService.listDevices(ctx),
    employeeService.list(ctx, { active: true }),
    deviceService.listRecentPunches(ctx, { take: 40 }),
  ])

  const mappings = (
    await Promise.all(devices.map((d) => deviceService.listDeviceUsers(ctx, d.id)))
  ).flat()

  return (
    <>
      <PageHeader
        title="Devices"
        description="Fingerprint / clock terminals. Map badge ids to employees, then POST punches to /api/attendance/punches."
        actions={
          <Button asChild type="button" size="sm" variant="outline">
            <Link href="/employees/attendance">Back to attendance</Link>
          </Button>
        }
      />
      <DevicesBoard
        devices={devices}
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
        mappings={mappings}
        punches={punches}
        canManage={ctx.permissions.has('hr:attendance')}
      />
    </>
  )
}