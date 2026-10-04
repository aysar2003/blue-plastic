import type { Metadata } from 'next'
import Link from 'next/link'

import { AppLauncher } from '@/components/layout/app-launcher'
import { ACCOUNTING_HUB_APPS, visibleHubApps } from '@/components/layout/module-hubs'
import {
  EXPENSE_COLOR,
  FigureChart,
  INCOME_COLOR,
  NET_COLOR,
  statementPicture,
} from '@/components/reports/figure-chart'
import { formatDate, today } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { resolvePeriod } from '@/lib/report-periods'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { profitAndLoss } from '@/server/reports/statements'

export const metadata: Metadata = { title: 'Accounting' }

/**
 * Accounting's front door — the same launcher the other modules use, with a
 * picture of the period's income and expenses above the destinations.
 */
export default async function AccountingHubPage() {
  const ctx = await requireOrgContext('account:read')
  const apps = visibleHubApps(ACCOUNTING_HUB_APPS, ctx.permissions)
  const currency = ctx.organization.baseCurrency
  const now = today(ctx.organization.timeZone)
  const month = resolvePeriod('this-month', now, ctx.organization.fiscalYearStartMonth)

  const [accounts, openPeriods, openInvoices, report] = await Promise.all([
    db.ledgerAccount.count({ where: { orgId: ctx.orgId, isActive: true } }),
    db.accountingPeriod.count({ where: { orgId: ctx.orgId, status: 'OPEN' } }),
    db.salesDocument.count({
      where: {
        orgId: ctx.orgId,
        type: 'INVOICE',
        status: { in: ['OPEN', 'PARTIAL'] },
        deletedAt: null,
      },
    }),
    profitAndLoss(ctx.orgId, { ...month, basis: 'accrual' }),
  ])

  const picture = statementPicture(report.sections, 'total')
  const pnlHref = '/reports/profit-loss?period=this-month'
  const detailHref = '/reports/profit-loss/detail?period=this-month'

  return (
    <AppLauncher
      eyebrow={ctx.organization.name}
      title="Accounting"
      subtitle="The chart, the journals, the periods — and a picture of what the books earned this month."
      apps={apps}
      insights={[
        {
          label: 'Net income',
          value: formatMoney(picture.net, currency),
          hint: `${formatDate(month.from)} – ${formatDate(month.to)}`,
          href: detailHref,
        },
        {
          label: 'Accounts',
          value: String(accounts),
          hint: 'on the chart',
          href: '/accounts',
        },
        {
          label: 'Open periods',
          value: String(openPeriods),
          hint: openPeriods === 1 ? 'month still open' : 'months still open',
          href: '/periods',
        },
      ]}
      banner={
        <div>
          <FigureChart
            caption={`This month · ${formatDate(month.from)} to ${formatDate(month.to)}`}
            currency={currency}
            bars={[
              {
                label: 'Income',
                value: picture.income,
                color: INCOME_COLOR,
                href: pnlHref,
              },
              {
                label: 'Expenses',
                value: picture.expenses,
                color: EXPENSE_COLOR,
                href: pnlHref,
              },
              {
                label: 'Net income',
                value: picture.net,
                color: NET_COLOR,
                href: detailHref,
              },
            ]}
          />
          <p className="mt-3 text-center text-sm text-slate-600">
            <Link href={pnlHref} className="font-medium text-primary underline-offset-4 hover:underline">
              Open the full profit and loss
            </Link>
            <span className="mx-2 text-slate-300">·</span>
            <Link
              href="/reports/balance-sheet"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Balance sheet
            </Link>
            {openInvoices > 0 ? (
              <>
                <span className="mx-2 text-slate-300">·</span>
                <Link
                  href="/sales/invoices?status=open"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {openInvoices} open invoice{openInvoices === 1 ? '' : 's'}
                </Link>
              </>
            ) : null}
          </p>
        </div>
      }
    />
  )
}
