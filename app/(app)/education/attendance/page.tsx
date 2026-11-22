import type { Metadata } from 'next'
import Link from 'next/link'

import { saveAttendanceAction } from '@/app/(app)/education/sis-actions'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ATTENDANCE_MARKS } from '@/lib/erp/school-sis'
import { requireOrgContext } from '@/server/auth/context'
import * as sis from '@/server/services/school-sis.service'

export const metadata: Metadata = { title: 'Attendance' }

export default async function EducationAttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const params = await searchParams
  const classId = typeof params.classId === 'string' ? params.classId : ''
  const onDate =
    typeof params.onDate === 'string' && params.onDate
      ? params.onDate
      : sis.defaultAttendanceDate()
  const classes = await sis.listClasses(ctx)

  const sheet =
    classId && classes.some((c) => c.id === classId)
      ? await sis.listAttendanceForClass(ctx, classId, onDate)
      : null

  return (
    <>
      <PageHeader
        title="Student attendance"
        description="Mark present, absent, late, or excused for a class day."
        actions={
          <Link href="/education/classes" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Classes
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <label className="text-sm">
              Class
              <select
                name="classId"
                required
                defaultValue={classId || classes[0]?.id}
                className="mt-1 block h-9 w-64 rounded-md border border-input bg-background px-2 text-sm"
              >
                {classes.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} · {row.term.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Date
              <Input name="onDate" type="date" required defaultValue={onDate} className="mt-1 w-44" />
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
              Open sheet
            </button>
          </form>
        </CardContent>
      </Card>

      {sheet ? (
        <form action={saveAttendanceAction}>
          <input type="hidden" name="classId" value={sheet.schoolClass.id} />
          <input type="hidden" name="onDate" value={sheet.onDate} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Mark</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheet.rows.map((row) => (
                <TableRow key={row.enrollmentId}>
                  <TableCell className="font-medium">
                    {row.studentName}
                    <input type="hidden" name="enrollmentId" value={row.enrollmentId} />
                  </TableCell>
                  <TableCell>
                    <select
                      name={`mark_${row.enrollmentId}`}
                      defaultValue={row.mark}
                      className="h-9 w-36 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {ATTENDANCE_MARKS.map((mark) => (
                        <option key={mark} value={mark}>
                          {mark}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Input
                      name={`note_${row.enrollmentId}`}
                      defaultValue={row.note}
                      className="w-full max-w-xs"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4">
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              Save attendance
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Choose a class and date to mark attendance.</p>
      )}
    </>
  )
}
