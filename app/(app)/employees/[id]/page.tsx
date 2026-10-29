import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/server/auth/context'
import * as employeeService from '@/server/services/employee.service'
import * as hrService from '@/server/services/employee-hr.service'
import * as payrollService from '@/server/services/payroll.service'
import { EmployeeDetail } from './employee-detail'
import { EmployeeDocumentsPanel } from './employee-documents'

export const metadata: Metadata = { title: 'Employee' }

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext('hr:read')
  const { id } = await params
  const [employee, linkable, managers, accounts, documents, wageChanges] = await Promise.all([
    employeeService.get(ctx, id).catch(() => null),
    employeeService.listLinkableUsers(ctx, id),
    employeeService.listManagers(ctx, id),
    payrollService.listPayAccounts(ctx),
    hrService.listDocuments(ctx, id).catch(() => []),
    employeeService.listWageChanges(ctx, id).catch(() => []),
  ])
  if (!employee) notFound()

  const subtitle = [employee.jobTitle, employee.department].filter(Boolean).join(' · ')

  return (
    <>
      <PageHeader
        title={employee.name}
        description={subtitle || 'Employee record'}
        actions={
          <Button asChild type="button" size="sm" variant="outline">
            <Link href={employee.active ? '/employees' : '/employees?archived=1'}>Back to list</Link>
          </Button>
        }
      />
      <EmployeeDetail
        employee={{
          id: employee.id,
          name: employee.name,
          jobTitle: employee.jobTitle,
          department: employee.department,
          photoUrl: employee.photoUrl,
          workEmail: employee.workEmail,
          workPhone: employee.workPhone,
          mobile: employee.mobile,
          workStreet: employee.workStreet,
          workCity: employee.workCity,
          workCountry: employee.workCountry,
          privateStreet: employee.privateStreet,
          privateCity: employee.privateCity,
          privateCountry: employee.privateCountry,
          emergencyContact: employee.emergencyContact,
          emergencyPhone: employee.emergencyPhone,
          skills: employee.skills,
          notes: employee.notes,
          employmentType: employee.employmentType,
          hiredAt: employee.hiredAt,
          leftAt: employee.leftAt,
          managerId: employee.managerId,
          userId: employee.userId,
          wageType: employee.wageType,
          wageAmount: employee.wageAmount,
          expenseAccountId: employee.expenseAccountId,
          payableAccountId: employee.payableAccountId,
          active: employee.active,
        }}
        linkableUsers={linkable}
        managers={managers}
        accounts={accounts}
        canUpdate={ctx.permissions.has('hr:update')}
        canDelete={ctx.permissions.has('hr:delete')}
        wageChanges={wageChanges.map((row) => ({
          at: row.at.toISOString(),
          actorName: row.actorName,
          fromType: row.fromType,
          toType: row.toType,
          fromAmount: row.fromAmount,
          toAmount: row.toAmount,
          note: row.note,
        }))}
        timeZone={ctx.organization.timeZone}
      />
      <div className="mt-8 max-w-4xl">
        <EmployeeDocumentsPanel
          employeeId={employee.id}
          documents={documents}
          canManage={ctx.permissions.has('hr:update')}
        />
      </div>
    </>
  )
}
