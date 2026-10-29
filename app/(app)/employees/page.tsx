import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/server/auth/context'
import * as employeeService from '@/server/services/employee.service'
import { EmployeesBoard } from './employees-board'

export const metadata: Metadata = { title: 'Employees' }

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('hr:read')
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : undefined
  const archived = params.archived === '1' || params.archived === 'true'
  const [rows, linkable, managers] = await Promise.all([
    employeeService.list(ctx, { q, active: archived ? false : true }),
    employeeService.listLinkableUsers(ctx),
    employeeService.listManagers(ctx),
  ])

  return (
    <>
      <PageHeader
        title="Employees"
        description="Company people directory — profile, contacts, addresses, and manager. Login access stays under Settings → Company users."
        actions={
          <div className="flex gap-2">
            {archived ? (
              <Button asChild type="button" size="sm" variant="outline">
                <Link href="/employees">Active</Link>
              </Button>
            ) : (
              <Button asChild type="button" size="sm" variant="outline">
                <Link href="/employees?archived=1">Archived</Link>
              </Button>
            )}
          </div>
        }
      />
      <EmployeesBoard
        rows={rows.map((row) => ({
          id: row.id,
          name: row.name,
          jobTitle: row.jobTitle,
          department: row.department,
          photoUrl: row.photoUrl,
          workEmail: row.workEmail,
          workPhone: row.workPhone,
          mobile: row.mobile,
          employmentType: row.employmentType,
          managerName: row.managerName,
          active: row.active,
          userName: row.userName,
        }))}
        linkableUsers={linkable}
        managers={managers}
        query={q ?? ''}
        archived={archived}
        canCreate={ctx.permissions.has('hr:create')}
      />
    </>
  )
}
