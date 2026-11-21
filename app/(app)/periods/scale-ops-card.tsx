import Link from 'next/link'

import {
  liveYearWindowLabel,
  REPORT_PACK_LIVE_YEAR_WARNING,
} from '@/lib/erp/scale-ops'

export function ScaleOpsCard({
  liveFromYear,
  currentFiscalYear,
  liveWindowYears,
  nextToArchive,
}: {
  liveFromYear: number
  currentFiscalYear: number
  liveWindowYears: number
  nextToArchive: { year: number } | null
}) {
  return (
    <div id="scale-checklist" className="rounded-lg border p-4 text-sm">
      <p className="font-medium">Scale checklist</p>
      <ul className="mt-3 space-y-2 text-muted-foreground">
        <li>
          <span className="text-foreground">Live-year window:</span>{' '}
          {liveYearWindowLabel(liveFromYear, currentFiscalYear, liveWindowYears)}. Partition hot
          data by orgId; use read replicas for reports.
        </li>
        <li>
          <span className="text-foreground">Archive closed year:</span>{' '}
          {nextToArchive ? (
            <>
              FY {nextToArchive.year} is ready.{' '}
              <Link
                href="#year-archive"
                className="text-primary underline-offset-4 hover:underline"
              >
                Archive FY {nextToArchive.year}
              </Link>
            </>
          ) : (
            <>
              No closed year is outside the live window yet.{' '}
              <Link href="#year-archive" className="text-primary underline-offset-4 hover:underline">
                Year archive tools
              </Link>
            </>
          )}
        </li>
        <li>
          <span className="text-foreground">Report packs:</span> {REPORT_PACK_LIVE_YEAR_WARNING}{' '}
          <Link href="/reports/packs" className="text-primary underline-offset-4 hover:underline">
            Reports → Packs
          </Link>
        </li>
      </ul>
      <p className="mt-3 text-muted-foreground">
        Operator notes live in <code className="text-xs">docs/ops/scale.md</code>.
      </p>
    </div>
  )
}
