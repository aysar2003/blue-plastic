import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  addClassMemberAction,
  removeClassMemberAction,
} from '@/app/(app)/education/sis-actions'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as sis from '@/server/services/school-sis.service'

export const metadata: Metadata = { title: 'Class roster' }

export default async function EducationClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const { id } = await params
  let schoolClass
  try {
    schoolClass = await sis.getClass(ctx, id)
  } catch {
    notFound()
  }
  const eligible = await sis.enrollmentsEligibleForClass(ctx, id)

  return (
    <>
      <PageHeader
        title={schoolClass.name}
        description={`${schoolClass.program.name} · ${schoolClass.term.name}${
          schoolClass.teacherName ? ` · ${schoolClass.teacherName}` : ''
        }`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/education/attendance?classId=${id}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Attendance
            </Link>
            <Link
              href={`/education/grades?classId=${id}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Grades
            </Link>
            <Link href="/education/classes" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              All classes
            </Link>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Add student to roster</CardTitle>
        </CardHeader>
        <CardContent>
          {eligible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No enrolled students left for this program and term. Enroll students first.
            </p>
          ) : (
            <form action={addClassMemberAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="classId" value={id} />
              <label className="text-sm">
                Student enrollment
                <select
                  name="enrollmentId"
                  required
                  className="mt-1 block h-9 w-72 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {eligible.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={buttonVariants({ size: 'sm' })}>
                Add to class
              </button>
            </form>
          )}
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Report</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {schoolClass.members.map((member) => (
            <TableRow key={member.id}>
              <TableCell className="font-medium">
                {member.enrollment.customer.displayName}
              </TableCell>
              <TableCell>
                <Link
                  href={`/education/report-cards/${member.enrollmentId}`}
                  className="text-sm underline underline-offset-4"
                >
                  Report card
                </Link>
              </TableCell>
              <TableCell>
                <form action={removeClassMemberAction}>
                  <input type="hidden" name="memberId" value={member.id} />
                  <button type="submit" className="text-sm text-destructive underline-offset-4 hover:underline">
                    Remove
                  </button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
