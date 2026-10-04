import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { StatementTable } from '@/components/reports/statement-table'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { balanceSheet, profitAndLoss } from '@/server/reports/statements'
import { ReportControls } from '../report-controls'
import { readSettings, type SearchParams } from '../params'

export const metadata: Metadata = { title: 'Profit and loss beside the balance sheet' }

export default async function SideBySidePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const settings = readSettings(query, ctx.organization)
  const currency = ctx.organization.baseCurrency

  const [report, sheet] = await Promise.all([
    profitAndLoss(ctx.orgId, { ...settings.range, basis: settings.basis }),
    balanceSheet(ctx.orgId, settings.asOf, { basis: settings.basis }),
  ])

  const drill = (accountId: string) =>
    `/reports/transaction-detail?account=${accountId}&period=custom&from=${settings.range.from}&to=${settings.range.to}`

  return (
    <>
      <PageHeader
        title="Profit and loss beside the balance sheet"
        description={`${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}. Both sides use this same range.`}
      />
      <p className="mb-3 text-sm text-muted-foreground">
        <Link href="/reports/profit-loss" className="text-primary underline-offset-4 hover:underline">
          Profit and loss alone
        </Link>
      </p>
      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison="none"
        controls={{ mode: 'range', basis: true, exportAs: 'profit-loss' }}
      />
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="border-b bg-primary/5 px-3 py-2 text-sm font-semibold text-primary">Profit and loss</div>
          <StatementTable sections={report.sections} currency={currency} drillTo={drill} />
        </Card>
        <Card className="overflow-hidden p-0">
          <div className="border-b bg-primary/5 px-3 py-2 text-sm font-semibold text-primary">
            Balance sheet at {formatDate(settings.asOf)}
          </div>
          <StatementTable
            sections={sheet.sections}
            currency={currency}
            drillTo={(accountId) =>
              `/reports/transaction-detail?account=${accountId}&period=custom&from=${settings.range.from}&to=${settings.asOf}`
            }
          />
        </Card>
      </div>
    </>
  )
}
