import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { formatDate, toCalendarDate } from '@/lib/date'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import * as periodService from '@/server/services/period.service'
import { MonthPanel, monthLabel } from '../month-panel'

export const metadata: Metadata = { title: 'Month' }

export default async function PeriodMonthPage({
  params,
  searchParams,
}: {
  params: Promise<{ periodId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('period:read')
  const { periodId } = await params
  const raw = await searchParams
  const period = await periodService.find(ctx, periodId)
  if (!period) notFound()

  const label = monthLabel(period.periodNumber, period.startDate)
  const from = toCalendarDate(period.startDate)
  const to = toCalendarDate(period.endDate)

  return (
    <>
      <PageHeader
        title={label}
        description={`${formatDate(from)} — ${formatDate(to)}. The entries posted in this month, and the reports for the same dates.`}
      />
      <MonthPanel
        periodId={period.id}
        query={parseListQuery(raw)}
        source={typeof raw.source === 'string' ? raw.source : undefined}
        basePath={`/periods/${period.id}`}
        linkParams={{}}
      />
    </>
  )
}
