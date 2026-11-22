import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toCalendarDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as education from '@/server/services/education.service'

export const metadata: Metadata = { title: 'Student history' }

export default async function StudentHistoryPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const { customerId } = await params
  let history
  try {
    history = await education.studentHistory(ctx, customerId)
  } catch (error) {
    if (isAppError(error) && error.code === 'NOT_FOUND') notFound()
    throw error
  }

  const { customer, enrollments } = history

  return (
    <>
      <PageHeader
        title={customer.displayName}
        description="Full school history across every year. Records are retained — nothing is purged by year-close."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/customers/${customer.id}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Customer card
            </Link>
            <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Education hub
            </Link>
          </div>
        }
      />

      <p className="mb-4 text-sm text-muted-foreground">
        {[customer.email, customer.phone || customer.mobile, customer.notes]
          .filter(Boolean)
          .join(' · ') || 'No contact details'}
      </p>

      {enrollments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No enrollments yet for this student.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Fee invoice</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Grades</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrollments.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.term.academicYear.label}
                  {row.term.academicYear.status === 'CLOSED' ? ' (prior)' : ''}
                </TableCell>
                <TableCell>
                  {row.term.name}
                  <div className="text-xs text-muted-foreground">
                    {toCalendarDate(row.term.startsOn)} – {toCalendarDate(row.term.endsOn)}
                  </div>
                </TableCell>
                <TableCell>{row.program.name}</TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>
                  {row.classMembers.map((m) => m.schoolClass.name).join(', ') || '—'}
                </TableCell>
                <TableCell>
                  {row.salesDocument ? (
                    <Link
                      href={`/sales/invoices/${row.salesDocument.id}`}
                      className="underline underline-offset-4"
                    >
                      {row.salesDocument.number} ({row.salesDocument.status})
                    </Link>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="tabular">{row.attendanceDays.length}</TableCell>
                <TableCell className="tabular">{row.gradeEntries.length}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
