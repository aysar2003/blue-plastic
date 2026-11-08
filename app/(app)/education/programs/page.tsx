import type { Metadata } from 'next'
import Link from 'next/link'

import { saveProgram } from '@/app/(app)/education/actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as education from '@/server/services/education.service'

export const metadata: Metadata = { title: 'Programs' }

export default async function EducationProgramsPage() {
  const ctx = await requireOrgContext('invoice:read')
  const programs = await education.listPrograms(ctx)

  return (
    <>
      <PageHeader
        title="Programs"
        description="Courses of study. Students enroll into a program for a term."
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <form action={saveProgram} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Name
              <Input name="name" required className="mt-1 w-56" placeholder="e.g. Form 3" />
            </label>
            <label className="text-sm">
              Code
              <Input name="code" className="mt-1 w-28" placeholder="F3" />
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              Add program
            </button>
          </form>
        </CardContent>
      </Card>

      {programs.length === 0 ? (
        <EmptyState title="No programs yet" description="Add the first program above." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {programs.map((program) => (
              <TableRow key={program.id}>
                <TableCell className="font-medium">{program.name}</TableCell>
                <TableCell className="text-muted-foreground">{program.code ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
