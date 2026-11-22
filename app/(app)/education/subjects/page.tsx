import type { Metadata } from 'next'
import Link from 'next/link'

import { saveSubjectAction } from '@/app/(app)/education/ops-actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as ops from '@/server/services/school-ops.service'

export const metadata: Metadata = { title: 'Subjects' }

export default async function EducationSubjectsPage() {
  const ctx = await requireOrgContext('invoice:read')
  const subjects = await ops.listSubjects(ctx)

  return (
    <>
      <PageHeader
        title="Subjects"
        description="Math, English, Science — link subjects to classes and the timetable."
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />
      <Card className="mb-6">
        <CardContent className="p-4">
          <form action={saveSubjectAction} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Name
              <Input name="name" required className="mt-1 w-56" placeholder="Mathematics" />
            </label>
            <label className="text-sm">
              Code
              <Input name="code" className="mt-1 w-28" placeholder="MATH" />
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              Add subject
            </button>
          </form>
        </CardContent>
      </Card>
      {subjects.length === 0 ? (
        <EmptyState title="No subjects yet" description="Add the subjects your school teaches." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">{row.code ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
