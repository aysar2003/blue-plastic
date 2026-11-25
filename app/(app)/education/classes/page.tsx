import type { Metadata } from 'next'
import Link from 'next/link'

import { saveClassAction } from '@/app/(app)/education/sis-actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as education from '@/server/services/education.service'
import * as ops from '@/server/services/school-ops.service'
import * as sis from '@/server/services/school-sis.service'

export const metadata: Metadata = { title: 'Classes' }

export default async function EducationClassesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const params = await searchParams
  const termId = typeof params.termId === 'string' ? params.termId : ''
  const [classes, programs, terms, campuses, teachers] = await Promise.all([
    sis.listClasses(ctx, termId || undefined),
    education.listPrograms(ctx),
    education.listTerms(ctx),
    ops.listCampuses(ctx),
    db.employee.findMany({
      where: { orgId: ctx.orgId, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 300,
    }),
  ])

  return (
    <>
      <PageHeader
        title="Classes"
        description="Sections for a program and term — roster, attendance, and grades."
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <form action={saveClassAction} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Name
              <Input name="name" required className="mt-1 w-44" placeholder="Form 3A" />
            </label>
            <label className="text-sm">
              Code
              <Input name="code" className="mt-1 w-24" placeholder="3A" />
            </label>
            <label className="text-sm">
              Teacher name
              <Input name="teacherName" className="mt-1 w-40" placeholder="Optional" />
            </label>
            <label className="text-sm">
              Teacher (employee)
              <select
                name="teacherEmployeeId"
                className="mt-1 block h-9 w-48 rounded-md border border-input bg-background px-2 text-sm"
                defaultValue=""
              >
                <option value="">None</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Campus
              <select
                name="campusId"
                className="mt-1 block h-9 w-40 rounded-md border border-input bg-background px-2 text-sm"
                defaultValue=""
              >
                <option value="">None</option>
                {campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Program
              <select
                name="programId"
                required
                className="mt-1 block h-9 w-48 rounded-md border border-input bg-background px-2 text-sm"
                defaultValue={programs[0]?.id}
              >
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Term
              <select
                name="termId"
                required
                className="mt-1 block h-9 w-48 rounded-md border border-input bg-background px-2 text-sm"
                defaultValue={termId || terms[0]?.id}
              >
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              Add class
            </button>
          </form>
        </CardContent>
      </Card>

      {classes.length === 0 ? (
        <EmptyState title="No classes yet" description="Add a class for a program and term." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Teacher</TableHead>
              <TableHead className="text-right">Roster</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link href={`/education/classes/${row.id}`} className="underline underline-offset-4">
                    {row.name}
                  </Link>
                  {row.code ? (
                    <span className="ml-2 text-xs text-muted-foreground">{row.code}</span>
                  ) : null}
                </TableCell>
                <TableCell>{row.program.name}</TableCell>
                <TableCell>{row.term.name}</TableCell>
                <TableCell className="text-muted-foreground">{row.teacherName ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{row._count.members}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
