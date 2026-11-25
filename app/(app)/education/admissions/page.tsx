import type { Metadata } from 'next'
import Link from 'next/link'

import {
  acceptAdmissionAction,
  createAdmissionAction,
  rejectAdmissionAction,
} from '@/app/(app)/education/actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as education from '@/server/services/education.service'

export const metadata: Metadata = { title: 'Admissions' }

export default async function EducationAdmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const query = await searchParams
  const [admissions, programs, terms, plans] = await Promise.all([
    education.listAdmissions(ctx, query.status || undefined),
    education.listPrograms(ctx),
    education.listTerms(ctx),
    education.listFeePlans(ctx),
  ])

  return (
    <>
      <PageHeader
        title="Admissions"
        description="Applications before enrollment — accept to create the student record and optional fee invoice."
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="space-y-4 p-4">
          <form action={createAdmissionAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">
              Applicant
              <Input name="applicantName" required className="mt-1" />
            </label>
            <label className="text-sm">
              Phone
              <Input name="phone" className="mt-1" />
            </label>
            <label className="text-sm">
              Email
              <Input name="email" type="email" className="mt-1" />
            </label>
            <label className="text-sm">
              Program
              <NativeSelect name="programId" className="mt-1">
                <option value="">Optional</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Term
              <NativeSelect name="termId" className="mt-1">
                <option value="">Optional</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Fee plan
              <NativeSelect name="feePlanId" className="mt-1">
                <option value="">None</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm sm:col-span-2 lg:col-span-3">
              Notes
              <Input name="notes" className="mt-1" />
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              Create application
            </button>
          </form>
        </CardContent>
      </Card>

      {admissions.length === 0 ? (
        <EmptyState title="No applications" description="Create the first admission application above." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applicant</TableHead>
              <TableHead>Program / term</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {admissions.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.applicantName}
                  {row.phone ? (
                    <p className="text-xs font-normal text-muted-foreground">{row.phone}</p>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.program?.name ?? '—'}
                  {row.term ? ` · ${row.term.name}` : ''}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{row.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {row.status !== 'ENROLLED' && row.status !== 'REJECTED' ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      <form action={acceptAdmissionAction} className="inline-flex flex-wrap items-center gap-1">
                        <input type="hidden" name="admissionId" value={row.id} />
                        <Input
                          name="admissionNumber"
                          placeholder="Adm #"
                          className="h-8 w-24 text-xs"
                          aria-label="Admission number"
                        />
                        <button
                          type="submit"
                          name="billNow"
                          value="0"
                          className={buttonVariants({ size: 'sm', variant: 'outline' })}
                        >
                          Accept
                        </button>
                        <button type="submit" name="billNow" value="1" className={buttonVariants({ size: 'sm' })}>
                          Accept & invoice
                        </button>
                      </form>
                      <form action={rejectAdmissionAction}>
                        <input type="hidden" name="admissionId" value={row.id} />
                        <button type="submit" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                          Reject
                        </button>
                      </form>
                    </div>
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