import type { Metadata } from 'next'
import Link from 'next/link'

import { createAssignmentAction } from '@/app/(app)/education/ops-actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as ops from '@/server/services/school-ops.service'
import * as sis from '@/server/services/school-sis.service'

export const metadata: Metadata = { title: 'Assignments' }

export default async function EducationAssignmentsPage() {
  const ctx = await requireOrgContext('invoice:read')
  const [classes, subjects, assignments] = await Promise.all([
    sis.listClasses(ctx),
    ops.listSubjects(ctx),
    ops.listAssignments(ctx),
  ])

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Homework and classwork for each class — practical LMS without SCORM."
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />
      <Card className="mb-6">
        <CardContent className="p-4">
          <form action={createAssignmentAction} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Class
              <select
                name="classId"
                required
                className="mt-1 block h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
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
              Title
              <Input name="title" required className="mt-1 w-56" placeholder="Chapter 4 homework" />
            </label>
            <label className="text-sm">
              Due
              <Input name="dueOn" type="date" className="mt-1 w-40" />
            </label>
            <label className="text-sm">
              Max score
              <Input name="maxScore" type="number" defaultValue="100" className="mt-1 w-24" />
            </label>
            <label className="w-full text-sm">
              Instructions
              <textarea
                name="body"
                rows={2}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              Publish assignment
            </button>
          </form>
        </CardContent>
      </Card>

      {assignments.length === 0 ? (
        <EmptyState title="No assignments" description="Publish homework for a class." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Roster</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link href={`/education/assignments/${row.id}`} className="underline underline-offset-4">
                    {row.title}
                  </Link>
                </TableCell>
                <TableCell>{row.schoolClass.name}</TableCell>
                <TableCell>{row.subject?.name ?? '—'}</TableCell>
                <TableCell className="tabular-nums">
                  {row.dueOn ? row.dueOn.toISOString().slice(0, 10) : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row._count.submissions}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
