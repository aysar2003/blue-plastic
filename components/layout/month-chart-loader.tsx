import { statementPicture } from '@/components/reports/figure-chart'
import { formatDate, today } from '@/lib/date'
import { resolvePeriod } from '@/lib/report-periods'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { profitAndLoss } from '@/server/reports/statements'
import { GlobalMonthChart, type MonthChartData } from './global-month-chart'

/** Server fetch for the Reports-home this-month chart. */
export async function MonthChartLoader({ ctx }: { ctx: OrgContext }) {
  const currency = ctx.organization.baseCurrency
  const now = today(ctx.organization.timeZone)
  const month = resolvePeriod('this-month', now, ctx.organization.fiscalYearStartMonth)

  const [report, openInvoices] = await Promise.all([
    profitAndLoss(ctx.orgId, { ...month, basis: 'accrual' }),
    db.salesDocument.count({
      where: {
        orgId: ctx.orgId,
        type: 'INVOICE',
        status: { in: ['OPEN', 'PARTIAL'] },
        deletedAt: null,
      },
    }),
  ])

  const picture = statementPicture(report.sections, 'total')
  const data: MonthChartData = {
    caption: `This month · ${formatDate(month.from)} to ${formatDate(month.to)}`,
    currency,
    income: picture.income.toString(),
    expenses: picture.expenses.toString(),
    net: picture.net.toString(),
    openInvoices,
  }

  return <GlobalMonthChart data={data} />
}
