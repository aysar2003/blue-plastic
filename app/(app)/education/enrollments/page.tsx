import type { Metadata } from 'next'
import Link from 'next/link'

import {
  awardScholarshipAction,
  billEnrollmentAction,
  billTermEnrollmentsAction,
  completeEnrollmentAction,
  enrollAndBill,
  withdrawEnrollmentAction,
} from '@/app/(app)/education/actions'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as education from '@/server/services/education.service'

export const metadata: Metadata = { title: 'Enrollments' }

export default async function EducationEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ termId?: string }>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const query = await searchParams
  const [enrollments, programs, terms, plans, customers, campuses] = await Promise.all([
    education.listEnrollments(ctx, query.termId || undefined),
    education.listPrograms(ctx),
    education.listTerms(ctx),
    education.listFeePlans(ctx),
    db.customer.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 500,
    }),
    db.schoolCampus.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])
  const currency = ctx.organization.baseCurrency
  const summary = query.termId ? await education.termSummary(ctx, query.termId) : null

  return (
    <>
      <PageHeader
        title="Enrollments"
        description="Link a student (customer) to a program and term, then raise the fee invoice. A scholarship award adds a fee-waiver line on the term invoice."
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/education/enrollments"
              className={buttonVariants({
                variant: !query.termId ? 'default' : 'outline',
                size: 'sm',
              })}
            >
              All terms
            </Link>
            {terms.map((term) => (
              <Link
                key={term.id}
                href={`/education/enrollments?termId=${term.id}`}
                className={buttonVariants({
                  variant: query.termId === term.id ? 'default' : 'outline',
                  size: 'sm',
                })}
              >
                {term.name}
              </Link>
            ))}
          </div>
          {summary ? (
            <p className="text-sm text-muted-foreground">
              {summary.term.name}: {summary.counts.active} active · {summary.counts.withdrawn}{' '}
              withdrawn · fees invoiced {formatMoney(summary.feesInvoiced, currency)}
            </p>
          ) : null}

          {query.termId ? (
            <form action={billTermEnrollmentsAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="termId" value={query.termId} />
              <Button type="submit" variant="secondary" size="sm">
                Bill all unbilled for this term
              </Button>
            </form>
          ) : null}

          <form action={enrollAndBill} className="grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">
              Student
              <NativeSelect name="customerId" required className="mt-1">
                <option value="">Choose…</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.displayName}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Program
              <NativeSelect name="programId" required className="mt-1">
                <option value="">Choose…</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Term
              <NativeSelect name="termId" required className="mt-1">
                <option value="">Choose…</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Fee plan
              <NativeSelect name="feePlanId" className="mt-1">
                <option value="">None yet</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Scholarship %
              <Input name="scholarshipPercent" defaultValue="0" className="mt-1" />
            </label>
            <label className="text-sm">
              Admission no.
              <Input name="admissionNumber" className="mt-1" placeholder="Optional" />
            </label>
            <label className="text-sm">
              Guardian name
              <Input name="guardianName" className="mt-1" />
            </label>
            <label className="text-sm">
              Guardian phone
              <Input name="guardianPhone" className="mt-1" />
            </label>
            <label className="text-sm">
              Gender
              <Input name="gender" className="mt-1" placeholder="Optional" />
            </label>
            <label className="text-sm">
              Date of birth
              <Input name="dateOfBirth" type="date" className="mt-1" />
            </label>
            <label className="text-sm">
              Bill guardian (optional)
              <NativeSelect name="billingCustomerId" className="mt-1">
                <option value="">Same as student</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.displayName}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Campus
              <NativeSelect name="campusId" className="mt-1">
                <option value="">None</option>
                {campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm sm:col-span-2">
              Notes
              <Input name="notes" className="mt-1" placeholder="Optional" />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <button type="submit" name="billNow" value="0" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                Enroll only
              </button>
              <button type="submit" name="billNow" value="1" className={buttonVariants({ size: 'sm' })}>
                Enroll & invoice
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {enrollments.length === 0 ? (
        <EmptyState
          title="No enrollments"
          description="Add programs, terms, and a fee plan, then enroll a student."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Program / term</TableHead>
              <TableHead>Scholarship</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrollments.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/education/students/${row.customerId}`}
                    className="underline underline-offset-4"
                  >
                    {row.customer.displayName}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">
                  {row.program.name}
                  <span className="text-muted-foreground"> · {row.term.name}</span>
                </TableCell>
                <TableCell className="tabular">
                  {Number(row.scholarshipPercent.toString()) > 0
                    ? `${row.scholarshipPercent.toString()}%`
                    : '—'}
                </TableCell>
                <TableCell>
                  {row.salesDocument ? (
                    <Link
                      href={`/sales/invoices/${row.salesDocument.id}`}
                      className="underline underline-offset-4"
                    >
                      {row.salesDocument.number} ·{' '}
                      {formatMoney(row.salesDocument.total.toString(), currency)}
                    </Link>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={row.status === 'ENROLLED' ? 'secondary' : 'outline'}>
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    {row.status === 'ENROLLED' && !row.salesDocument ? (
                      <form action={awardScholarshipAction} className="inline-flex items-center gap-1">
                        <input type="hidden" name="enrollmentId" value={row.id} />
                        <Input
                          name="percent"
                          defaultValue={row.scholarshipPercent.toString()}
                          className="h-8 w-16 text-xs"
                          aria-label="Scholarship percent"
                        />
                        <button type="submit" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                          Award
                        </button>
                      </form>
                    ) : null}
                    {!row.salesDocument && row.status === 'ENROLLED' && row.feePlan ? (
                      <form action={billEnrollmentAction}>
                        <input type="hidden" name="enrollmentId" value={row.id} />
                        <button type="submit" className={buttonVariants({ size: 'sm' })}>
                          Invoice
                        </button>
                      </form>
                    ) : null}
                    {row.status === 'ENROLLED' ? (
                      <form action={completeEnrollmentAction}>
                        <input type="hidden" name="enrollmentId" value={row.id} />
                        <button
                          type="submit"
                          className={buttonVariants({ size: 'sm', variant: 'outline' })}
                        >
                          Complete
                        </button>
                      </form>
                    ) : null}
                    {row.status === 'ENROLLED' ? (
                      <form action={withdrawEnrollmentAction}>
                        <input type="hidden" name="enrollmentId" value={row.id} />
                        <button
                          type="submit"
                          className={buttonVariants({ size: 'sm', variant: 'outline' })}
                        >
                          Withdraw
                        </button>
                      </form>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
