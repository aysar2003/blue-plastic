import type { Metadata } from 'next'
import Link from 'next/link'

import { createDisciplineAction } from '@/app/(app)/education/ops-actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DISCIPLINE_SEVERITIES } from '@/lib/erp/school-ops'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as ops from '@/server/services/school-ops.service'

export const metadata: Metadata = { title: 'Discipline' }

export default async function EducationDisciplinePage() {
  const ctx = await requireOrgContext('invoice:read')
  const [rows, enrollments] = await Promise.all([
    ops.listDiscipline(ctx),
    ops.activeEnrollmentsOptions(ctx),
  ])

  return (
    <>
      <PageHeader
        title="Discipline"
        description="Behaviour notes, warnings, detention, and suspension records."
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />
      <Card className="mb-6">
        <CardContent className="p-4">
          <form action={createDisciplineAction} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Student
              <select
                name="enrollmentId"
                required
                className="mt-1 block h-9 w-64 rounded-md border border-input bg-background px-2 text-sm"
              >
                {enrollments.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Date
              <Input name="onDate" type="date" required defaultValue={today()} className="mt-1 w-40" />
            </label>
            <label className="text-sm">
              Severity
              <select
                name="severity"
                defaultValue="NOTE"
                className="mt-1 block h-9 w-40 rounded-md border border-input bg-background px-2 text-sm"
              >
                {DISCIPLINE_SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Title
              <Input name="title" required className="mt-1 w-56" />
            </label>
            <label className="w-full text-sm">
              Detail
              <textarea
                name="detail"
                rows={2}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              Record
            </button>
          </form>
        </CardContent>
      </Card>
      {rows.length === 0 ? (
        <EmptyState title="No discipline records" description="Record the first note above." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Title</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="tabular-nums">{row.onDate.toISOString().slice(0, 10)}</TableCell>
                <TableCell className="font-medium">{row.enrollment.customer.displayName}</TableCell>
                <TableCell>{row.severity}</TableCell>
                <TableCell>
                  <div>{row.title}</div>
                  {row.detail ? (
                    <div className="text-xs text-muted-foreground">{row.detail}</div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
