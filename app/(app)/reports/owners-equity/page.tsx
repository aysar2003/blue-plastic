import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Card } from '@/components/ui/card'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { ownersEquityStatement, totalEquity } from '@/server/reports/owners-equity-statement'

export const metadata: Metadata = { title: "Owner's equity statement" }

export default async function OwnersEquityReportPage() {
  const ctx = await requireOrgContext('report:read')
  const report = await ownersEquityStatement(ctx)

  return (
    <>
      <PageHeader
        title="Owner&apos;s equity statement"
        description="Capital, retained earnings, and recorded equity events."
      />
      <Card className="max-w-lg space-y-2 p-6 text-sm">
        <Row label="Owner's capital (3000 series)" amount={report.capitalBalance} currency={report.currency} />
        <Row label="Retained earnings" amount={report.retainedEarningsBalance} currency={report.currency} />
        <Row label="Total equity" amount={totalEquity(report)} currency={report.currency} strong />
        <hr className="my-2" />
        <Row label="Contributions (events)" amount={report.contributions} currency={report.currency} />
        <Row label="Draws (events)" amount={report.draws} currency={report.currency} />
        <Row label="Dividends (events)" amount={report.dividends} currency={report.currency} />
        <Row label="Net from events" amount={report.netChange} currency={report.currency} />
      </Card>
    </>
  )
}

function Row({
  label,
  amount,
  currency,
  strong,
}: {
  label: string
  amount: { toFixed: (n: number) => string }
  currency: string
  strong?: boolean
}) {
  return (
    <p className={strong ? 'font-semibold' : undefined}>
      {label}: {formatMoney(amount.toFixed(2), currency)}
    </p>
  )
}
