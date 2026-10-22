import type { Metadata } from 'next'

import { readSort } from '@/components/data/sortable-header'
import { PageHeader } from '@/components/data/page-header'
import { PrintButton } from '@/app/(app)/sales/[type]/[id]/print/print-button'
import { ReportEntityFilters } from '@/components/reports/report-entity-filters'
import { STATEMENT_SORT_COLUMNS, StatementTable } from '@/components/reports/statement-table'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/date'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import type { ReportFilterKind } from '@/server/reports/catalogue'
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
import { groupReportScope } from '@/server/services/company-group.service'
import { loadFilterOptions } from '../filter-options'
import { GroupReportBanner } from '../group-report-banner'
import { ReportControls } from '../report-controls'
import {
  COMPARISON_LABELS,
  readEntityFilters,
  readSettings,
  settingsToQuery,
  type SearchParams,
} from '../params'

const PL_FILTERS: ReportFilterKind[] = ['customer', 'vendor', 'item', 'account', 'store']

export const metadata: Metadata = { title: 'Profit and Loss' }

export default async function ProfitAndLossPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const settings = readSettings(query, ctx.organization)
  const filters = readEntityFilters(query)
  const currency = ctx.organization.baseCurrency
  const sort = readSort(query, STATEMENT_SORT_COLUMNS, { sort: 'detail', dir: 'asc' })
  const linkParams = {
    period: settings.period,
    from: settings.range.from,
    to: settings.range.to,
    asOf: settings.asOf,
    basis: settings.basis,
    compare: settings.comparison === 'none' ? undefined : settings.comparison,
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
    ...(filters.itemId ? { itemId: filters.itemId } : {}),
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    ...(filters.storeId ? { storeId: filters.storeId } : {}),
  }
  const filtered = Boolean(
    filters.customerId || filters.vendorId || filters.itemId || filters.accountId || filters.storeId,
  )

  const [report, note, groupScope, filterOptions] = await Promise.all([
    profitAndLoss(ctx.orgId, { ...settings.range, basis: settings.basis }, {
      comparison: settings.comparisonRange,
      filters,
    }),
    workspace.readReportNote(ctx, 'profit-loss'),
    groupReportScope(ctx),
    loadFilterOptions(ctx.orgId, PL_FILTERS),
  ])
  const showGroup = groupScope.companies.length >= 2

  const drill = (accountId: string) =>
    `/reports/transaction-detail?account=${accountId}&period=custom&from=${settings.range.from}&to=${settings.range.to}&back=/reports/profit-loss`

  const detailQs = new URLSearchParams({
    period: settings.period,
    from: settings.range.from,
    to: settings.range.to,
    basis: settings.basis,
  })
  const detailHref = `/reports/profit-loss/detail?${detailQs}`

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
    compared
      ? { label, amount, comparison, emphasis, href: detailHref }
      : { label, amount, emphasis, href: detailHref }

  return (
    <>
      <PageHeader
        organization={ctx.organization}
        title="Profit and Loss"
        description={`${formatDate(settings.range.from)} to ${formatDate(settings.range.to)} · ${
          settings.basis === 'cash' ? 'cash basis' : 'accrual basis'
        }`}
        actions={
          <PrintButton
            paper="profit and loss"
            defaultSubject={`Profit and Loss — ${ctx.organization.name}`}
            defaultBody={`Profit and Loss\n${ctx.organization.name}\n${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}`}
          />
        }
      />

      <p className="mb-3 text-sm">
        <a href={`/reports/side-by-side?${new URLSearchParams({ period: settings.period, from: settings.range.from, to: settings.range.to, basis: settings.basis })}`} className="font-medium text-primary underline-offset-4 hover:underline">
          Open beside the balance sheet
        </a>
      </p>

      <ReportNote reportKey="profit-loss" initial={note} />

      {showGroup ? (
        <GroupReportBanner
          companies={groupScope.companies}
          currentOrgId={ctx.orgId}
          periodQuery={settingsToQuery(settings)}
        />
      ) : null}

      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: 'range', basis: true, comparison: true, exportAs: 'profit-loss' }}
      />

      <ReportEntityFilters kinds={PL_FILTERS} values={filters} options={filterOptions} />
      {filtered ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Showing only journals that match the filters above — not the full company books.
        </p>
      ) : null}

      <div className="mb-4">
        <FigureChart
          caption="Income, expenses and the profit they leave"
          currency={currency}
          comparisonLabel={comparisonLabel}
          bars={[
            {
              label: 'Income',
              value: picture.income,
              comparison: previous?.income,
              color: INCOME_COLOR,
              href: detailHref,
            },
            {
              label: 'Expenses',
              value: picture.expenses,
              comparison: previous?.expenses,
              color: EXPENSE_COLOR,
              href: detailHref,
            },
            {
              label: 'Net income',
              value: picture.net,
              comparison: previous?.net,
              color: NET_COLOR,
              href: detailHref,
            },
          ]}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <StatementTable
            sections={report.sections}
            currency={currency}
            drillTo={drill}
            showPercent
            comparisonLabel={comparisonLabel}
            sort={sort}
            basePath="/reports/profit-loss"
            linkParams={linkParams}
            subtotals={{
              cogs: [line('Gross profit', report.grossProfit, comparedGross)],
              expenses: [line('Operating profit', report.operatingProfit, comparedOperating)],
              otherExpense: [line('Net income', report.netIncome, comparedNet, true)],
            }}
          />

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
