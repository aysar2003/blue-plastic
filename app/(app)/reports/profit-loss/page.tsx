import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { StatementTable } from '@/components/reports/statement-table'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/date'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { profitAndLoss } from '@/server/reports/statements'
import { ReportNote } from '@/components/reports/report-note'
import {
  EXPENSE_COLOR,
  FigureChart,
  INCOME_COLOR,
  NET_COLOR,
  statementPicture,
} from '@/components/reports/figure-chart'
import * as workspace from '@/server/services/workspace.service'
import { ReportControls } from '../report-controls'
import { COMPARISON_LABELS, readSettings, type SearchParams } from '../params'

export const metadata: Metadata = { title: 'Profit and Loss' }

export default async function ProfitAndLossPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const settings = readSettings(query, ctx.organization)
  const currency = ctx.organization.baseCurrency

  const [report, note] = await Promise.all([
    profitAndLoss(ctx.orgId, { ...settings.range, basis: settings.basis }, {
      comparison: settings.comparisonRange,
    }),
    workspace.readReportNote(ctx, 'profit-loss'),
  ])

  const drill = (accountId: string) =>
    `/reports/transaction-detail?account=${accountId}&period=custom&from=${settings.range.from}&to=${settings.range.to}&back=/reports/profit-loss`

  const picture = statementPicture(report.sections, 'total')
  const compared = settings.comparison !== 'none'
  const previous = compared ? statementPicture(report.sections, 'comparisonTotal') : null
  const comparisonLabel = compared ? COMPARISON_LABELS[settings.comparison] : undefined
  const sectionAmount = (key: string) =>
    report.sections.find((section) => section.key === key)?.comparisonTotal ?? ZERO
  const comparedGross = sectionAmount('income').minus(sectionAmount('cogs'))
  const comparedOperating = comparedGross.minus(sectionAmount('expenses'))
  const comparedNet = comparedOperating.plus(sectionAmount('otherIncome')).minus(sectionAmount('otherExpense'))
  const line = (label: string, amount: Decimal, comparison: Decimal, emphasis = false) =>
    compared ? { label, amount, comparison, emphasis } : { label, amount, emphasis }

  return (
    <>
      <PageHeader
        title="Profit and Loss"
        description={`${formatDate(settings.range.from)} to ${formatDate(settings.range.to)} · ${
          settings.basis === 'cash' ? 'cash basis' : 'accrual basis'
        }`}
      />

      <p className="mb-3 text-sm">
        <a href={`/reports/side-by-side?${new URLSearchParams({ period: settings.period, from: settings.range.from, to: settings.range.to, basis: settings.basis })}`} className="font-medium text-primary underline-offset-4 hover:underline">
          Open beside the balance sheet
        </a>
      </p>

      <ReportNote reportKey="profit-loss" initial={note} />

      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: 'range', basis: true, comparison: true, exportAs: 'profit-loss' }}
      />

      <div className="mb-4">
        <FigureChart
          caption="Income, expenses and the profit they leave"
          currency={currency}
          comparisonLabel={comparisonLabel}
          bars={[
            { label: 'Income', value: picture.income, comparison: previous?.income, color: INCOME_COLOR },
            { label: 'Expenses', value: picture.expenses, comparison: previous?.expenses, color: EXPENSE_COLOR },
            { label: 'Net income', value: picture.net, comparison: previous?.net, color: NET_COLOR },
          ]}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <StatementTable
            sections={report.sections}
            currency={currency}
            drillTo={drill}
            showPercent
            comparisonLabel={comparisonLabel}
            subtotals={{
              cogs: [line('Gross profit', report.grossProfit, comparedGross)],
              expenses: [line('Operating profit', report.operatingProfit, comparedOperating)],
              otherExpense: [line('Net income', report.netIncome, comparedNet, true)],
            }}
          />
        </div>

        <div className="border-t px-3 py-2.5 text-sm text-muted-foreground">
          {report.totalIncome.isZero() && !previous ? (
            'No income was recorded in this period.'
          ) : previous ? (
            <>
              Net income moved from{' '}
              <strong className="tabular text-foreground">{formatMoney(previous.net, currency)}</strong> to{' '}
              <strong className="tabular text-foreground">{formatMoney(picture.net, currency)}</strong>, a change of{' '}
              <span className="tabular">{formatMoney(picture.net.minus(previous.net), currency)}</span>.
            </>
          ) : (
            <>
              Net income is{' '}
              <strong className="tabular text-foreground">{formatMoney(report.netIncome, currency)}</strong> on income
              of <span className="tabular">{formatMoney(report.totalIncome, currency)}</span> — a margin of{' '}
              <span className="tabular">
                {report.netIncome.dividedBy(report.totalIncome).times(100).toFixed(1)}%
              </span>
              .
            </>
          )}
        </div>
      </Card>
    </>
  )
}
