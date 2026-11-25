import type { Metadata } from 'next'
import Link from 'next/link'

import { saveExamAction, saveExamSlotAction } from '@/app/(app)/education/ops-actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as ops from '@/server/services/school-ops.service'
import * as education from '@/server/services/education.service'
import * as sis from '@/server/services/school-sis.service'

export const metadata: Metadata = { title: 'Exams' }

export default async function EducationExamsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const params = await searchParams
  const examId = typeof params.examId === 'string' ? params.examId : ''
  const classIdFilter = typeof params.classId === 'string' ? params.classId : ''
  const [exams, terms, classes, subjects] = await Promise.all([
    ops.listExams(ctx, { classId: classIdFilter || undefined }),
    education.listTerms(ctx),
    sis.listClasses(ctx),
    ops.listSubjects(ctx),
  ])
  let activeExam: Awaited<ReturnType<typeof ops.getExam>> | null = null
  if (examId) {
    try {
      activeExam = await ops.getExam(ctx, examId)
    } catch {
      activeExam = null
    }
  }

  return (
    <>
      <PageHeader
        title="Exams"
        description="Exam timetables per class and term."
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Create exam</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveExamAction} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Title
              <Input name="title" required className="mt-1 w-56" placeholder="End of term" />
            </label>
            <label className="text-sm">
              Term
              <NativeSelect name="termId" required className="mt-1" defaultValue={terms[0]?.id}>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Class
              <NativeSelect name="classId" required className="mt-1" defaultValue={classes[0]?.id}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.term.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              Save exam
            </button>
          </form>
        </CardContent>
      </Card>

      {exams.length === 0 ? (
        <EmptyState title="No exams" description="Create an exam timetable above." />
      ) : (
        <Table className="mb-8">
          <TableHeader>
            <TableRow>
              <TableHead>Exam</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Term</TableHead>
              <TableHead className="text-right">Slots</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exams.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/education/exams?examId=${row.id}`}
                    className="underline underline-offset-4"
                  >
                    {row.title}
                  </Link>
                </TableCell>
                <TableCell>{row.schoolClass.name}</TableCell>
                <TableCell>{row.term.name}</TableCell>
                <TableCell className="text-right tabular-nums">{row._count.slots}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {activeExam ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {activeExam.title} · {activeExam.schoolClass.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form action={saveExamSlotAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="examId" value={activeExam.id} />
              <label className="text-sm">
                Date
                <Input name="onDate" type="date" required className="mt-1 w-40" />
              </label>
              <label className="text-sm">
                Start
                <Input name="startsAt" required placeholder="08:00" className="mt-1 w-28" />
              </label>
              <label className="text-sm">
                End
                <Input name="endsAt" required placeholder="10:00" className="mt-1 w-28" />
              </label>
              <label className="text-sm">
                Subject
                <NativeSelect name="subjectId" className="mt-1">
                  <option value="">—</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="text-sm">
                Room
                <Input name="room" className="mt-1 w-28" />
              </label>
              <label className="text-sm">
                Invigilator
                <Input name="invigilatorName" className="mt-1 w-40" />
              </label>
              <button type="submit" className={buttonVariants({ size: 'sm' })}>
                Add slot
              </button>
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Invigilator</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeExam.slots.map((slot) => (
                  <TableRow key={slot.id}>
                    <TableCell>{slot.onDate.toISOString().slice(0, 10)}</TableCell>
                    <TableCell className="tabular-nums">
                      {slot.startsAt}–{slot.endsAt}
                    </TableCell>
                    <TableCell>{slot.subject?.name ?? '—'}</TableCell>
                    <TableCell>{slot.room ?? '—'}</TableCell>
                    <TableCell>{slot.invigilatorName ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}