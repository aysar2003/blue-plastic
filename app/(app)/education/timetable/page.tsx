import type { Metadata } from 'next'
import Link from 'next/link'

import { linkSubjectAction, saveTimetableSlotAction } from '@/app/(app)/education/ops-actions'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { WEEKDAYS } from '@/lib/erp/school-ops'
import { requireOrgContext } from '@/server/auth/context'
import * as ops from '@/server/services/school-ops.service'
import * as sis from '@/server/services/school-sis.service'

export const metadata: Metadata = { title: 'Timetable' }

export default async function EducationTimetablePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const params = await searchParams
  const classes = await sis.listClasses(ctx)
  const subjects = await ops.listSubjects(ctx)
  const classId = typeof params.classId === 'string' ? params.classId : classes[0]?.id || ''
  const board = classId ? await ops.listTimetable(ctx, classId) : null

  return (
    <>
      <PageHeader
        title="Timetable"
        description="Build the weekly period grid for each class."
        actions={
          <Link href="/education/subjects" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Subjects
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Class
              <select
                name="classId"
                defaultValue={classId}
                className="mt-1 block h-9 w-64 rounded-md border border-input bg-background px-2 text-sm"
              >
                {classes.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} · {row.term.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
              Open
            </button>
          </form>
        </CardContent>
      </Card>

      {board ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Link subject to {board.schoolClass.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={linkSubjectAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="classId" value={board.schoolClass.id} />
                <label className="text-sm">
                  Subject
                  <select
                    name="subjectId"
                    required
                    className="mt-1 block h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Teacher
                  <Input name="teacherName" className="mt-1 w-40" />
                </label>
                <button type="submit" className={buttonVariants({ size: 'sm' })}>
                  Link subject
                </button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add period</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={saveTimetableSlotAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="classId" value={board.schoolClass.id} />
                <label className="text-sm">
                  Day
                  <select
                    name="dayOfWeek"
                    className="mt-1 block h-9 w-28 rounded-md border border-input bg-background px-2 text-sm"
                    defaultValue={1}
                  >
                    {WEEKDAYS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Period #
                  <Input name="periodIndex" type="number" min={1} max={16} defaultValue={1} className="mt-1 w-24" />
                </label>
                <label className="text-sm">
                  Start
                  <Input name="startsAt" required placeholder="08:00" className="mt-1 w-28" />
                </label>
                <label className="text-sm">
                  End
                  <Input name="endsAt" required placeholder="08:45" className="mt-1 w-28" />
                </label>
                <label className="text-sm">
                  Subject
                  <select
                    name="subjectId"
                    className="mt-1 block h-9 w-48 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">—</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Room
                  <Input name="room" className="mt-1 w-28" />
                </label>
                <button type="submit" className={buttonVariants({ size: 'sm' })}>
                  Save slot
                </button>
              </form>
            </CardContent>
          </Card>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Room</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {board.slots.map((slot) => (
                <TableRow key={slot.id}>
                  <TableCell>{WEEKDAYS.find((d) => d.value === slot.dayOfWeek)?.label ?? slot.dayOfWeek}</TableCell>
                  <TableCell className="tabular-nums">{slot.periodIndex}</TableCell>
                  <TableCell className="tabular-nums">
                    {slot.startsAt}–{slot.endsAt}
                  </TableCell>
                  <TableCell>{slot.subject?.name ?? '—'}</TableCell>
                  <TableCell>{slot.room ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Create a class first.</p>
      )}
    </>
  )
}
