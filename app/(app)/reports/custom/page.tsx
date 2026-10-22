import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { FavouriteReports } from '@/components/reports/favourite-reports'
import { ReportCentreTabs } from '@/components/reports/report-centre-tabs'
import { Button } from '@/components/ui/button'
import { withoutBusinessOverview } from '@/lib/business-overview-access'
import { STANDARD_FAVOURITES } from '@/lib/standard-reports'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { forgetMemorizedReport } from '../memorize-actions'

export const metadata: Metadata = { title: 'Custom reports' }

export default async function CustomReportsPage() {
  const ctx = await requireOrgContext('report:read')
  const memorized = await db.workspaceBookmark.findMany({
    where: {
      orgId: ctx.orgId,
      userId: ctx.userId,
      kind: 'memorized-report',
    },
    orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
    select: { id: true, label: true, href: true },
  })

  return (
    <>
      <ReportCentreTabs active="custom" />
      <PageHeader
        organization={ctx.organization}
        title="Custom reports"
        description="Memorized report views (period and filters) plus starred standard favourites."
      />

      {memorized.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Memorized
          </h2>
          <ul className="divide-y rounded-md border bg-card">
            {memorized.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <Link href={row.href} className="font-medium hover:underline">
                  {row.label}
                </Link>
                <form action={forgetMemorizedReport.bind(null, row.href)}>
                  <Button type="submit" variant="ghost" size="sm">
                    Forget
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mb-6 text-sm text-muted-foreground">
          Open any catalogue report and click Memorize to keep its filters here.
        </p>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Favourites
      </h2>
      <FavouriteReports reports={withoutBusinessOverview(STANDARD_FAVOURITES, ctx.permissions)} />
    </>
  )
}
