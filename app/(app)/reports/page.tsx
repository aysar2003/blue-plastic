import type { Metadata } from 'next'
import Link from 'next/link'

import { AppLauncher } from '@/components/layout/app-launcher'
import { REPORT_SECTIONS } from '@/components/layout/report-apps'
import {
  EXPENSE_COLOR,
  FigureChart,
  INCOME_COLOR,
  NET_COLOR,
  statementPicture,
} from '@/components/reports/figure-chart'
import { formatDate, today } from '@/lib/date'
import { resolvePeriod } from '@/lib/report-periods'
import { requireOrgContext } from '@/server/auth/context'
import { profitAndLoss } from '@/server/reports/statements'

export const metadata: Metadata = { title: 'Reports' }

/**
 * Every report, grouped by the question it answers, drawn as the same tiles
 * Sales uses for its own reports.
 */
export default async function ReportsIndexPage() {
  const ctx = await requireOrgContext('report:read')
  const now = today(ctx.organization.timeZone)
  const month = resolvePeriod('this-month', now, ctx.organization.fiscalYearStartMonth)
  const report = await profitAndLoss(ctx.orgId, { ...month, basis: 'accrual' })
  const picture = statementPicture(report.sections, 'total')

  return (
    <AppLauncher
      eyebrow={ctx.organization.name}
      title="Reports"
      subtitle="Grouped the way QuickBooks Online groups them. Every figure is read from the ledger."
      sections={REPORT_SECTIONS}
      searchable
      banner={
        <div>
          <FigureChart
            caption={`This month · ${formatDate(month.from)} to ${formatDate(month.to)}`}
            currency={ctx.organization.baseCurrency}
            bars={[
              { label: 'Income', value: picture.income, color: INCOME_COLOR },
              { label: 'Expenses', value: picture.expenses, color: EXPENSE_COLOR },
              { label: 'Net income', value: picture.net, color: NET_COLOR },
            ]}
          />
          <p className="mt-3 text-center text-sm">
            <Link
              href="/reports/profit-loss?period=this-month&compare=prior-period"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Open the full profit and loss, compared with the previous period
            </Link>
          </p>
        </div>
      }
    />
  )
}
