import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { updateSubmissionAction } from '@/app/(app)/education/ops-actions'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ASSIGNMENT_STATUSES } from '@/lib/erp/school-ops'
import { requireOrgContext } from '@/server/auth/context'
import * as ops from '@/server/services/school-ops.service'

export const metadata: Metadata = { title: 'Assignment board' }

export default async function EducationAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const { id } = await params
  let board
  try {
    board = await ops.getAssignmentBoard(ctx, id)
  } catch {
    notFound()
  }

  return (
    <>
      <PageHeader
        title={board.title}
        description={`${board.schoolClass.name}${board.subject ? ` · ${board.subject.name}` : ''}${
          board.dueOn ? ` · due ${board.dueOn.toISOString().slice(0, 10)}` : ''
        }`}
        actions={
          <Link href="/education/assignments" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            All assignments
          </Link>
        }
      />
      {board.body ? <p className="mb-6 max-w-3xl text-sm text-muted-foreground">{board.body}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Note</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {board.submissions.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.enrollment.customer.displayName}</TableCell>
              <TableCell colSpan={4}>
                <form action={updateSubmissionAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="assignmentId" value={board.id} />
                  <input type="hidden" name="submissionId" value={row.id} />
                  <select
                    name="status"
                    defaultValue={row.status}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {ASSIGNMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <Input
                    name="score"
                    type="number"
                    step="0.01"
                    placeholder="Score"
                    defaultValue={row.score != null ? Number(row.score) : ''}
                    className="w-24"
                  />
                  <Input name="note" defaultValue={row.note ?? ''} className="min-w-[10rem] flex-1" />
                  <button type="submit" className={buttonVariants({ size: 'sm' })}>
                    Save
                  </button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
