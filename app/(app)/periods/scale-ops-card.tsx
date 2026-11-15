import Link from 'next/link'

import { LIVE_FISCAL_YEARS } from '@/lib/year-archive'

export function ScaleOpsCard() {
  return (
    <div className="rounded-lg border p-4 text-sm">
      <p className="font-medium">Scale &amp; archive ops</p>
      <p className="mt-1 text-muted-foreground">
        Partition hot data by orgId, use read replicas for reports, and archive closed fiscal years on a
        {` ${LIVE_FISCAL_YEARS}-year `}
        live window. Use the archive card above for year-end packages. Operator notes live in{' '}
        <code className="text-xs">docs/ops/scale.md</code>.
      </p>
      <Link href="/periods" className="text-primary mt-2 inline-block underline-offset-4 hover:underline">
        Year archive tools
      </Link>
    </div>
  )
}