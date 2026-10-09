import type { Metadata } from 'next'
import Link from 'next/link'

import { GiveFeedback } from '@/components/data/give-feedback'
import { AppLauncher } from '@/components/layout/app-launcher'
import { reportSectionsFor } from '@/components/layout/report-apps'
import { CreateReportMenu } from '@/components/reports/create-report-menu'
import { FavouriteReports } from '@/components/reports/favourite-reports'
import { ReportCentreTabs } from '@/components/reports/report-centre-tabs'
import { canViewBusinessOverview, withoutBusinessOverview } from '@/lib/business-overview-access'
import { STANDARD_FAVOURITES } from '@/lib/standard-reports'
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
  const showOverview = canViewBusinessOverview(ctx.permissions)
  const now = today(ctx.organization.timeZone)
  const month = resolvePeriod('this-month', now, ctx.organization.fiscalYearStartMonth)
  const report = await profitAndLoss(ctx.orgId, { ...month, basis: 'accrual' })
  const picture = statementPicture(report.sections, 'total')

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-4 print:hidden">
        <GiveFeedback />
        <CreateReportMenu permissions={[...ctx.permissions]} />
      </div>
      <ReportCentreTabs active="standard" />
      <FavouriteReports reports={withoutBusinessOverview(STANDARD_FAVOURITES, ctx.permissions)} />
    <AppLauncher
      eyebrow={ctx.organization.name}
      title="Reports"
      subtitle="Grouped the way QuickBooks Online groups them. Every figure is read from the ledger."
      sections={reportSectionsFor(ctx.permissions)}
      searchable
      banner={
        <div>
          <FigureChart
            caption={`This month · ${formatDate(month.from)} to ${formatDate(month.to)}`}
            currency={ctx.organization.baseCurrency}
            bars={[
              {
                label: 'Income',
                value: picture.income,
                color: INCOME_COLOR,
                href: '/reports/profit-loss?period=this-month',
              },
              {
                label: 'Expenses',
                value: picture.expenses,
                color: EXPENSE_COLOR,
                href: '/reports/profit-loss?period=this-month',
              },
              {
                label: 'Net income',
                value: picture.net,
                color: NET_COLOR,
                href: '/reports/profit-loss/detail?period=this-month',
              },
            ]}
          />
          <p className="mt-3 text-center text-sm">
            {showOverview ? (
              <>
                <Link
                  href="/reports/business-overview"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Business overview
                </Link>
                <span className="text-muted-foreground"> · </span>
              </>
            ) : null}
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
    </>
  )
}
