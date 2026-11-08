import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  accountingCoverageBullets,
  coverageSummary,
  institutionCoverage,
} from '@/lib/packs'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'What SOM ERP covers' }

/**
 * Honest institution coverage — static catalogue (no heavy queries).
 * Safe under high page views: pure module data + one auth check.
 */
export default async function HelpCoveragePage() {
  await requireOrgContext()
  const rows = institutionCoverage()
  const summary = coverageSummary()
  const accounting = accountingCoverageBullets()

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHeader
        title="What SOM ERP covers"
        description="Which institutions the product is built for, what the books can do, and what stays out of scope."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Snapshot</CardTitle>
          <CardDescription>
            {summary.modulePresetsReady} installable module presets · {summary.verticalReady}{' '}
            verticals ready
            {summary.verticalPlanned > 0
              ? ` · ${summary.verticalPlanned} verticals still planned`
              : ' · coverage gate clear'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Choose your institution from{' '}
            <Link href="/onboarding" className="underline underline-offset-4">
              onboarding
            </Link>{' '}
            or ask a system owner to install a pack from Databases → Limits.
          </p>
          <p>
            <Link href="/help/guide" className="underline underline-offset-4">
              Back to the guide
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accounting & books</CardTitle>
          <CardDescription>Core ledger capabilities every pack builds on.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {accounting.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold tracking-tight">Institutions</h2>
        {rows.map((row) => (
          <Card key={row.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {row.label}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  · {row.verticalStatus === 'ready' ? 'vertical ready' : 'vertical planned'}
                </span>
              </CardTitle>
              <CardDescription>{row.blurb}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  In scope
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {row.inScope.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Out of scope
                </p>
                {row.outOfScope.length === 0 ? (
                  <p className="mt-1 text-muted-foreground">None listed for this pack.</p>
                ) : (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {row.outOfScope.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
