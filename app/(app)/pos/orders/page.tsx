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
  const query = readPosOrderReportQuery(await searchParams, today(ctx.organization.timeZone))
  const report = await posService.listPosOrders(ctx, query)

  return (
    <PosOrdersReport
      orders={report.orders}
      summary={report.summary}
      registers={report.registers}
      methods={report.methods}
      query={query}
      truncated={report.truncated}
      limit={report.limit}
    />
  )
}
