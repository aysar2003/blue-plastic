import type { Metadata } from 'next'
import Link from 'next/link'

import { saveTerm } from '@/app/(app)/education/actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toCalendarDate, today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as education from '@/server/services/education.service'

export const metadata: Metadata = { title: 'Terms' }

export default async function EducationTermsPage({
  searchParams,
}: {
  searchParams: Promise<{ yearId?: string; prior?: string }>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const query = await searchParams
  const years = await education.listAcademicYears(ctx)
  const openYear = years.find((y) => y.status === 'OPEN') ?? null
  const yearId = query.yearId || openYear?.id || years[0]?.id
  const selectedYear = years.find((y) => y.id === yearId) ?? null
  const showPrior = query.prior === '1' || (selectedYear?.status === 'CLOSED')
  const terms = yearId
    ? await education.listTerms(ctx, {
        academicYearId: yearId,
        includeInactive: showPrior || selectedYear?.status === 'CLOSED',
      })
    : await education.listTerms(ctx, { includeInactive: showPrior })
  const start = today(ctx.organization.timeZone)
  const readOnly = selectedYear?.status === 'CLOSED'

  return (
    <>
      <PageHeader
        title="Terms"
        description="Academic periods used for enrollment and fee invoices. Prior years stay available — never deleted."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/education/years" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              School years
            </Link>
            <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Education hub
            </Link>
          </div>
        }
      />

      {years.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {years.map((year) => (
            <Link
              key={year.id}
              href={`/education/terms?yearId=${year.id}${year.status === 'CLOSED' ? '&prior=1' : ''}`}
              className={buttonVariants({
                size: 'sm',
                variant: year.id === yearId ? 'default' : 'outline',
              })}
            >
              {year.label}
              {year.status === 'CLOSED' ? ' (prior)' : ''}
            </Link>
          ))}
          <Link
            href="/education/terms?prior=1"
            className={buttonVariants({
              size: 'sm',
              variant: !query.yearId && showPrior ? 'default' : 'outline',
            })}
          >
            Show prior years
          </Link>
        </div>
      ) : null}

      {!readOnly ? (
        <Card className="mb-6">
          <CardContent className="p-4">
            <form action={saveTerm} className="flex flex-wrap items-end gap-3">
              {openYear ? <input type="hidden" name="academicYearId" value={openYear.id} /> : null}
              <label className="text-sm">
                Name
                <Input
                  name="name"
                  required
                  className="mt-1 w-48"
                  placeholder={openYear ? `${openYear.label} Term 1` : '2026 Term 1'}
                />
              </label>
              <label className="text-sm">
                Starts
                <Input name="startsOn" type="date" required defaultValue={start} className="mt-1" />
              </label>
              <label className="text-sm">
                Ends
                <Input name="endsOn" type="date" required defaultValue={start} className="mt-1" />
              </label>
              <button type="submit" className={buttonVariants({ size: 'sm' })}>
                Add term
              </button>
            </form>
            {!openYear ? (
              <p className="mt-3 text-xs text-muted-foreground">
                <Link href="/education/years" className="underline underline-offset-4">
                  Open a school year
                </Link>{' '}
                before adding terms.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">
          This school year is closed (read-only). History is kept; open a new year to add terms.
        </p>
      )}

      {terms.length === 0 ? (
        <EmptyState title="No terms yet" description="Add the first term above, or open a school year." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Starts</TableHead>
              <TableHead>Ends</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {terms.map((term) => (
              <TableRow key={term.id}>
                <TableCell className="font-medium">{term.name}</TableCell>
                <TableCell>
                  {term.academicYear.label}
                  {term.academicYear.status === 'CLOSED' ? ' (prior)' : ''}
                </TableCell>
                <TableCell className="tabular">{toCalendarDate(term.startsOn)}</TableCell>
                <TableCell className="tabular">{toCalendarDate(term.endsOn)}</TableCell>
                <TableCell>{term.isActive ? 'Yes' : 'No'}</TableCell>
                <TableCell>
                  {term.academicYear.status === 'OPEN' ? (
                    <details>
                      <summary className="cursor-pointer text-sm underline underline-offset-4">
                        Edit
                      </summary>
                      <form action={saveTerm} className="mt-2 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="id" value={term.id} />
                        <Input name="name" required defaultValue={term.name} className="w-40" />
                        <Input
                          name="startsOn"
                          type="date"
                          required
                          defaultValue={toCalendarDate(term.startsOn)}
                          className="w-36"
                        />
                        <Input
                          name="endsOn"
                          type="date"
                          required
                          defaultValue={toCalendarDate(term.endsOn)}
                          className="w-36"
                        />
                        <button type="submit" className={buttonVariants({ size: 'sm' })}>
                          Save
                        </button>
                      </form>
                    </details>
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
