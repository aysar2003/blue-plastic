import type { Metadata } from 'next'
import Link from 'next/link'

import {
  closeAcademicYearAction,
  openAcademicYearAction,
  promoteEnrollmentsAction,
} from '@/app/(app)/education/actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toCalendarDate } from '@/lib/date'
import { nextAcademicYearLabel } from '@/lib/erp/academic-year-lifecycle'
import { db } from '@/server/db'
import { requireOrgContext } from '@/server/auth/context'
import { ensureEducationBootstrap } from '@/server/services/education-bootstrap.service'
import * as education from '@/server/services/education.service'

export const metadata: Metadata = { title: 'School years' }

export default async function AcademicYearsPage() {
  const ctx = await requireOrgContext('invoice:read')
  await db.$transaction((tx) =>
    ensureEducationBootstrap(tx, ctx.orgId, ctx.organization.installedPackId),
  )
  const years = await education.listAcademicYears(ctx)
  const openYear = years.find((y) => y.status === 'OPEN') ?? null
  const latestClosed = years.find((y) => y.status === 'CLOSED') ?? null
  const openTerms = openYear
    ? await education.listTerms(ctx, { academicYearId: openYear.id, includeInactive: true })
    : []
  const suggestedLabel = latestClosed
    ? nextAcademicYearLabel(latestClosed.label)
    : openYear
      ? nextAcademicYearLabel(openYear.label)
      : String(new Date().getUTCFullYear())

  return (
    <>
      <PageHeader
        title="School years"
        description="Open and close academic years. Closed years stay readable forever — nothing is deleted."
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="space-y-4 p-4">
          {!openYear ? (
            <form action={openAcademicYearAction} className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                New year label
                <Input
                  name="label"
                  required
                  className="mt-1 w-40"
                  defaultValue={suggestedLabel}
                  placeholder="2027"
                />
              </label>
              {latestClosed ? (
                <input type="hidden" name="copyFromYearId" value={latestClosed.id} />
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="cloneFeePlans" value="1" />
                Clone fee plans
              </label>
              <button type="submit" className={buttonVariants({ size: 'sm' })}>
                Open school year
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Current open year: <span className="font-medium text-foreground">{openYear.label}</span>.
                Close it when the year ends — all student and school data stays.
              </p>
              <form action={closeAcademicYearAction}>
                <input type="hidden" name="yearId" value={openYear.id} />
                <button type="submit" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Close {openYear.label} (keep all data)
                </button>
              </form>
            </div>
          )}

          {openYear && latestClosed && openTerms[0] ? (
            <form
              action={promoteEnrollmentsAction}
              className="flex flex-wrap items-end gap-3 border-t border-border pt-4"
            >
              <input type="hidden" name="fromYearId" value={latestClosed.id} />
              <label className="text-sm">
                Promote into term
                <select
                  name="toTermId"
                  required
                  className="mt-1 flex h-9 w-56 rounded-md border border-input bg-transparent px-3 text-sm"
                  defaultValue={openTerms.find((t) => !/vacation/i.test(t.name))?.id ?? openTerms[0].id}
                >
                  {openTerms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="cloneClasses" value="1" />
                Clone classes &amp; roster
              </label>
              <button type="submit" className={buttonVariants({ size: 'sm' })}>
                Promote from {latestClosed.label}
              </button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {years.length === 0 ? (
        <EmptyState
          title="No school years yet"
          description="Open the first year below — Term 1 / Term 2 are created for you. Prior years stay forever once closed."
          action={
            <form action={openAcademicYearAction}>
              <input type="hidden" name="label" value={suggestedLabel} />
              <button type="submit" className={buttonVariants({ size: 'sm' })}>
                Open {suggestedLabel}
              </button>
            </form>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Starts</TableHead>
              <TableHead>Ends</TableHead>
              <TableHead>Terms</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {years.map((year) => (
              <TableRow key={year.id}>
                <TableCell className="font-medium">{year.label}</TableCell>
                <TableCell>{year.status}</TableCell>
                <TableCell className="tabular">{toCalendarDate(year.startsOn)}</TableCell>
                <TableCell className="tabular">{toCalendarDate(year.endsOn)}</TableCell>
                <TableCell>{year._count.terms}</TableCell>
                <TableCell>
                  <Link
                    href={`/education/terms?yearId=${year.id}`}
                    className="text-sm underline underline-offset-4"
                  >
                    Terms
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
