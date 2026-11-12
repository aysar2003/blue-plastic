import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'
import * as education from '@/server/services/education.service'

export const metadata: Metadata = { title: 'Education' }

export default async function EducationHubPage() {
  const ctx = await requireOrgContext('invoice:read')
  const [stats, outstanding] = await Promise.all([
    education.hubStats(ctx),
    education.feesOutstandingByTerm(ctx),
  ])
  const outstandingTotal = outstanding.reduce((sum, row) => sum + Number(row.outstanding), 0)

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHeader
        title="School / university fees"
        description="Programs, terms, and fee plans that raise AR invoices. Not an LMS or SIS."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Snapshot</CardTitle>
          <CardDescription>
            {stats.programs} programs · {stats.terms} terms · {stats.activeEnrollments} active
            enrollments
            {outstanding.length > 0
              ? ` · ${outstanding.length} term${outstanding.length === 1 ? '' : 's'} with open fees`
              : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-4">
            <Link href="/education/programs" className="underline underline-offset-4">
              Programs
            </Link>
            <Link href="/education/terms" className="underline underline-offset-4">
              Terms
            </Link>
            <Link href="/education/fees" className="underline underline-offset-4">
              Fee plans
            </Link>
            <Link href="/education/enrollments" className="underline underline-offset-4">
              Enrollments
            </Link>
            <Link href="/education/fees-outstanding" className="underline underline-offset-4">
              Fees outstanding by term
            </Link>
            <Link href="/customers" className="underline underline-offset-4">
              Students (customers)
            </Link>
          </div>
          {outstanding.length > 0 ? (
            <p className="text-muted-foreground">
              Open fee balance across terms:{' '}
              <span className="font-medium text-foreground tabular-nums">
                {outstandingTotal.toFixed(2)}
              </span>{' '}
              {ctx.organization.baseCurrency}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
