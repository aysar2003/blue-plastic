import type { Metadata } from 'next'

import { PosOrdersReport } from '@/components/pos/orders-report'
import { today } from '@/lib/date'
import { readPosOrderReportQuery } from '@/lib/pos-order-report'
import { requireOrgContext } from '@/server/auth/context'
import * as posService from '@/server/services/pos.service'

export const metadata: Metadata = { title: 'POS Orders' }

export default async function PosOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('pos:read')
  const asOf = today(ctx.organization.timeZone)
  const query = readPosOrderReportQuery(await searchParams, asOf)
  const report = await posService.listPosOrders(ctx, query)

  return (
    <PosOrdersReport
      orders={report.orders}
      summary={report.summary}
      totals={report.totals}
      grand={report.grand}
      registers={report.registers}
      methods={report.methods}
      query={query}
      today={asOf}
      truncated={report.truncated}
      limit={report.limit}
    />
  )
}
