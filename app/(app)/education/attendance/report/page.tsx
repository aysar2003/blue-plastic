import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as sis from '@/server/services/school-sis.service'

export const metadata: Metadata = { title: 'Attendance register' }

export default async function AttendanceRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const params = await searchParams
  const classId = typeof params.classId === 'string' ? params.classId : ''
  const fromDate = typeof params.from === 'string' ? params.from : ''
  const toDate = typeof params.to === 'string' ? params.to : fromDate
  const classes = await sis.listClasses(ctx)
  const activeClassId = classId || classes[0]?.id || ''
  const register =
    activeClassId && fromDate && toDate
      ? await sis.attendanceRegister(ctx, activeClassId, fromDate, toDate)
      : null

  const csvHref =
    activeClassId && fromDate && toDate
      ? `/api/education/attendance-register?${new URLSearchParams({
          classId: activeClassId,
          from: fromDate,
          to: toDate,
        }).toString()}`
      : null

  return (
    <>
      <PageHeader
        title="Attendance register"
        description="Date-range roll for a class — present, absent, late, and excused counts."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/education/attendance" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Daily attendance
            </Link>
            <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Education hub
            </Link>
          </div>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Class
              <select
                name="classId"
                defaultValue={activeClassId}
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
              From
              <Input name="from" type="date" defaultValue={fromDate} required className="mt-1 w-40" />
            </label>
            <label className="text-sm">
              To
              <Input name="to" type="date" defaultValue={toDate || fromDate} required className="mt-1 w-40" />
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
              Build register
            </button>
            {csvHref ? (
              <a href={csvHref} className={buttonVariants({ size: 'sm', variant: 'outline' })} download>
                Download CSV
              </a>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {register ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background">Student</TableHead>
                {register.dates.map((date) => (
                  <TableHead key={date} className="text-center text-xs">
                    {date.slice(5)}
                  </TableHead>
                ))}
                <TableHead className="text-right">P</TableHead>
                <TableHead className="text-right">A</TableHead>
                <TableHead className="text-right">L</TableHead>
                <TableHead className="text-right">E</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {register.rows.map((row) => (
                <TableRow key={row.enrollmentId}>
                  <TableCell className="sticky left-0 bg-background font-medium">{row.studentName}</TableCell>
                  {row.marks.map((mark) => (
                    <TableCell key={mark.onDate} className="text-center text-xs tabular-nums">
                      {mark.mark?.slice(0, 1) ?? '·'}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums">{row.summary.present}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.summary.absent}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.summary.late}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.summary.excused}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Choose a class and date range.</p>
      )}
    </>
  )
}