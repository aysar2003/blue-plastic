import type { Metadata } from 'next'
import Link from 'next/link'

import { saveGradeItemAction, saveGradeScoresAction } from '@/app/(app)/education/sis-actions'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as sis from '@/server/services/school-sis.service'

export const metadata: Metadata = { title: 'Grades' }

export default async function EducationGradesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const params = await searchParams
  const classId = typeof params.classId === 'string' ? params.classId : ''
  const gradeItemId = typeof params.gradeItemId === 'string' ? params.gradeItemId : ''
  const classes = await sis.listClasses(ctx)
  const activeClassId = classId || classes[0]?.id || ''
  const book = activeClassId ? await sis.classGradebook(ctx, activeClassId) : null
  const activeItem =
    book?.items.find((item) => item.id === gradeItemId) ?? book?.items[0] ?? null

  return (
    <>
      <PageHeader
        title="Grades"
        description="Assessments and weighted averages for a class. Parents can view report cards in the portal."
        actions={
          <Link href="/education/classes" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Classes
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
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
            <button type="submit" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
              Open gradebook
            </button>
          </form>
        </CardContent>
      </Card>

      {book ? (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={saveGradeItemAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="classId" value={book.schoolClass.id} />
                <label className="text-sm">
                  Name
                  <Input name="name" required className="mt-1 w-48" placeholder="Midterm" />
                </label>
                <label className="text-sm">
                  Max score
                  <Input name="maxScore" type="number" step="0.01" defaultValue="100" className="mt-1 w-28" />
                </label>
                <label className="text-sm">
                  Weight %
                  <Input
                    name="weightPercent"
                    type="number"
                    step="0.01"
                    defaultValue="100"
                    className="mt-1 w-28"
                  />
                </label>
                <label className="text-sm">
                  Due
                  <Input name="dueOn" type="date" className="mt-1 w-40" />
                </label>
                <button type="submit" className={buttonVariants({ size: 'sm' })}>
                  Add assessment
                </button>
              </form>
            </CardContent>
          </Card>

          {activeItem ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Enter scores · {activeItem.name} (max {Number(activeItem.maxScore)})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form method="get" className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="classId" value={book.schoolClass.id} />
                  <label className="text-sm">
                    Assessment
                    <select
                      name="gradeItemId"
                      defaultValue={activeItem.id}
                      className="mt-1 block h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {book.items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                    Switch
                  </button>
                </form>

                <form action={saveGradeScoresAction}>
                  <input type="hidden" name="classId" value={book.schoolClass.id} />
                  <input type="hidden" name="gradeItemId" value={activeItem.id} />
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Comment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {book.students.map((student) => {
                        const current = student.scores.find((s) => s.gradeItemId === activeItem.id)
                        return (
                          <TableRow key={student.enrollmentId}>
                            <TableCell className="font-medium">
                              {student.studentName}
                              <input type="hidden" name="enrollmentId" value={student.enrollmentId} />
                            </TableCell>
                            <TableCell>
                              <Input
                                name={`score_${student.enrollmentId}`}
                                type="number"
                                step="0.01"
                                defaultValue={current?.score ?? ''}
                                className="w-28"
                              />
                            </TableCell>
                            <TableCell>
                              <Input name={`comment_${student.enrollmentId}`} className="max-w-xs" />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  <div className="mt-4">
                    <button type="submit" className={buttonVariants({ size: 'sm' })}>
                      Save scores
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Class averages</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-right">Average %</TableHead>
                    <TableHead>Letter</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {book.students.map((student) => (
                    <TableRow key={student.enrollmentId}>
                      <TableCell className="font-medium">{student.studentName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {student.averagePercent == null ? '—' : student.averagePercent.toFixed(2)}
                      </TableCell>
                      <TableCell>{student.letter}</TableCell>
                      <TableCell>
                        <Link
                          href={`/education/report-cards/${student.enrollmentId}`}
                          className="text-sm underline underline-offset-4"
                        >
                          Report card
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Create a class first, then open the gradebook.</p>
      )}
    </>
  )
}
