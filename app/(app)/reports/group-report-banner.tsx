import Link from 'next/link'

import type { GroupCompanyOption } from '@/lib/company-group'

/**
 * Shown on Profit and Loss (and similar) when the signed-in owner can read the
 * company group — jump to one / each / combined without leaving reports.
 */
export function GroupReportBanner({
  companies,
  currentOrgId,
  periodQuery,
}: {
  companies: GroupCompanyOption[]
  currentOrgId: string
  /** Keep the dates the user already chose. */
  periodQuery: string
}) {
  if (companies.length < 2) return null

  const qs = periodQuery ? `&${periodQuery}` : ''
  const oneQs = new URLSearchParams(periodQuery)
  oneQs.set('view', 'one')
  oneQs.set('org', currentOrgId)

  return (
    <div className="mb-4 rounded-lg border border-teal-400/30 bg-teal-400/[0.06] px-4 py-3 print:hidden">
      <p className="text-sm font-medium">Company group reports</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        You own linked companies. Open one company&apos;s books, each side by side, or the combined
        profit and loss.
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link
          href={`/reports/companies?${oneQs.toString()}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          One company
        </Link>
        <Link
          href={`/reports/companies?view=each${qs}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Each company
        </Link>
        <Link
          href={`/reports/companies?view=combined${qs}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Combined P&amp;L
        </Link>
      </div>
    </div>
  )
}
