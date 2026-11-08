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

export default async function EducationTermsPage() {
  const ctx = await requireOrgContext('invoice:read')
  const terms = await education.listTerms(ctx)
  const start = today(ctx.organization.timeZone)

  return (
    <>
      <PageHeader
        title="Terms"
        description="Academic periods used for enrollment and fee invoices."
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <form action={saveTerm} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Name
              <Input name="name" required className="mt-1 w-48" placeholder="2026 Term 1" />
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
        </CardContent>
      </Card>

      {terms.length === 0 ? (
        <EmptyState title="No terms yet" description="Add the first term above." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Starts</TableHead>
              <TableHead>Ends</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {terms.map((term) => (
              <TableRow key={term.id}>
                <TableCell className="font-medium">{term.name}</TableCell>
                <TableCell className="tabular">{toCalendarDate(term.startsOn)}</TableCell>
                <TableCell className="tabular">{toCalendarDate(term.endsOn)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
