import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangleIcon, CheckCircle2Icon } from 'lucide-react'

import { PageHeader } from '@/components/data/page-header'
import { PrintButton } from '@/app/(app)/sales/[type]/[id]/print/print-button'
import { ClickableRow } from '@/components/reports/clickable-row'
import { ReportEntityFilters } from '@/components/reports/report-entity-filters'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/date'
import { formatMoney, type Money, ZERO } from '@/lib/money'
import { REPORT_DRILL_LINK } from '@/lib/report-drill'
import { requireOrgContext } from '@/server/auth/context'
import { FigureChart, INCOME_COLOR, NET_COLOR } from '@/components/reports/figure-chart'
import type { ReportFilterKind } from '@/server/reports/catalogue'
import { cashFlow, type CashFlowLine } from '@/server/reports/statements'
import { loadFilterOptions } from '../filter-options'
import { ReportControls } from '../report-controls'
import {
  COMPARISON_LABELS,
  readEntityFilters,
  readSettings,
  type SearchParams,
} from '../params'

const CF_FILTERS: ReportFilterKind[] = ['customer', 'vendor', 'item', 'account', 'store']

export const metadata: Metadata = { title: 'Statement of Cash Flows' }

export default async function CashFlowPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const settings = readSettings(query, ctx.organization)
  const filters = readEntityFilters(query)
  const currency = ctx.organization.baseCurrency
  const filtered = Boolean(
    filters.customerId || filters.vendorId || filters.itemId || filters.accountId || filters.storeId,
  )
  const compared = settings.comparison !== 'none' && Boolean(settings.comparisonRange)
  const comparisonLabel = compared ? COMPARISON_LABELS[settings.comparison] : undefined
  const columns = compared ? 3 : 2

  const [report, filterOptions] = await Promise.all([
    cashFlow(ctx.orgId, settings.range, {
      filters,
      comparison: settings.comparisonRange,
    }),
    loadFilterOptions(ctx.orgId, CF_FILTERS),
  ])
  const detail = (accountId: string) =>
    `/reports/transaction-detail?account=${accountId}&period=custom&from=${settings.range.from}&to=${settings.range.to}&back=/reports/cash-flow`
  const profitAndLoss = `/reports/profit-loss?period=custom&from=${settings.range.from}&to=${settings.range.to}`
  const previous = report.comparison

  return (
    <>
      <PageHeader
        organization={ctx.organization}
        title="Statement of Cash Flows"
        description={`${formatDate(settings.range.from)} to ${formatDate(settings.range.to)} · indirect method`}
        actions={
          <PrintButton
            paper="cash flow"
            defaultSubject={`Cash Flows — ${ctx.organization.name}`}
            defaultBody={`Statement of Cash Flows\n${ctx.organization.name}\n${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}`}
          />
        }
      />

      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: 'range', comparison: true, exportAs: 'cash-flow' }}
      />

      <ReportEntityFilters kinds={CF_FILTERS} values={filters} options={filterOptions} />
      {filtered ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Showing only journals that match the filters above — the cash-flow check may not
          reconcile until filters are cleared.
        </p>
      ) : null}

      <div className="mb-4">
        <FigureChart
          caption="How the profit became cash"
          currency={currency}
          bars={[
            { label: 'Net income', value: report.netIncome, color: NET_COLOR },
            { label: 'Net change in cash', value: report.netChange, color: '#1E3A5F' },
            { label: 'Cash at the end', value: report.closingCash, color: INCOME_COLOR },
          ]}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Movement</TableHead>
                <TableHead className="numeric w-36">Amount</TableHead>
                {comparisonLabel ? (
                  <TableHead className="numeric w-36">{comparisonLabel}</TableHead>
                ) : null}
                {comparisonLabel ? <TableHead className="numeric w-36">Change</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              <Section
                label="Operating activities"
                lines={report.operating.lines}
                currency={currency}
                detail={detail}
                columns={columns}
                compared={compared}
              >
                <Row
                  label="Net income"
                  amount={report.netIncome}
                  comparison={previous?.netIncome}
                  currency={currency}
                  indent
                  href={profitAndLoss}
                  compared={compared}
                />
              </Section>
              <Total
                label="Cash from operating activities"
                amount={report.operating.total}
                comparison={report.operating.comparisonTotal ?? previous?.operatingTotal}
                currency={currency}
                compared={compared}
              />

              <Section
                label="Investing activities"
                lines={report.investing.lines}
                currency={currency}
                detail={detail}
                columns={columns}
                compared={compared}
              />
              <Total
                label="Cash from investing activities"
                amount={report.investing.total}
                comparison={report.investing.comparisonTotal ?? previous?.investingTotal}
                currency={currency}
                compared={compared}
              />

              <Section
                label="Financing activities"
                lines={report.financing.lines}
                currency={currency}
                detail={detail}
                columns={columns}
                compared={compared}
              />
              <Total
                label="Cash from financing activities"
                amount={report.financing.total}
                comparison={report.financing.comparisonTotal ?? previous?.financingTotal}
                currency={currency}
                compared={compared}
              />

              <MoneyRow
                label="Net change in cash"
                amount={report.netChange}
                comparison={previous?.netChange}
                currency={currency}
                compared={compared}
                emphasis
              />
              <MoneyRow
                label="Cash at the start of the period"
                amount={report.openingCash}
                comparison={previous?.openingCash}
                currency={currency}
                compared={compared}
                muted
                indent
              />
              <MoneyRow
                label="Cash at the end of the period"
                amount={report.closingCash}
                comparison={previous?.closingCash}
                currency={currency}
                compared={compared}
                emphasis
              />
            </TableBody>
          </Table>

        <div
          className={`flex items-center gap-2 border-t px-3 py-2.5 text-sm ${
            report.reconciles ? 'text-success' : 'text-destructive'
          }`}
        >
          {report.reconciles ? (
            <>
              <CheckCircle2Icon className="size-4 shrink-0" />
              <span>The statement explains the whole movement in the cash accounts.</span>
            </>
          ) : (
            <>
              <AlertTriangleIcon className="size-4 shrink-0" />
              <span>
                Unexplained movement of{' '}
                <strong className="tabular">{formatMoney(report.difference.abs(), currency)}</strong>. This should be
                impossible — report it before relying on any other figure.
              </span>
            </>
          )}
        </div>
      </Card>
    </>
  )
}

function Section({
  label,
  lines,
  currency,
  detail,
  children,
  columns,
  compared,
}: {
  label: string
  lines: CashFlowLine[]
  currency: string
  detail: (accountId: string) => string
  children?: React.ReactNode
  columns: number
  compared: boolean
}) {
  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell colSpan={columns} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </TableCell>
      </TableRow>
      {children}
      {lines.length === 0 && !children ? (
        <TableRow>
          <TableCell colSpan={columns} className="py-3 pl-6 text-sm text-muted-foreground">
            No movement.
          </TableCell>
        </TableRow>
      ) : (
        lines.map((line) => (
          <Row
            key={line.accountId}
            label={line.label}
            amount={line.amount}
            comparison={line.comparison}
            currency={currency}
            indent
            href={detail(line.accountId)}
            compared={compared}
          />
        ))
      )}
    </>
  )
}

function Row({
  label,
  amount,
  comparison,
  currency,
  indent,
  href,
  compared,
}: {
  label: string
  amount: Money
  comparison?: Money
  currency: string
  indent?: boolean
  href?: string
  compared: boolean
}) {
  const figure = formatMoney(amount, currency)
  const prior = comparison ?? ZERO
  return (
    <ClickableRow href={href} title={href ? 'Open transactions for this account' : undefined}>
      <TableCell className={indent ? 'pl-6' : ''}>
        {href ? (
          <Link href={href} className={REPORT_DRILL_LINK}>
            {label}
          </Link>
        ) : (
          label
        )}
      </TableCell>
      <TableCell className="numeric tabular">
        {href ? (
          <Link href={href} className={REPORT_DRILL_LINK}>
            {figure}
          </Link>
        ) : (
          figure
        )}
      </TableCell>
      {compared ? (
        <TableCell className="numeric tabular text-muted-foreground">
          {formatMoney(prior, currency)}
        </TableCell>
      ) : null}
      {compared ? (
        <TableCell className="numeric tabular">
          {formatMoney(amount.minus(prior), currency)}
        </TableCell>
      ) : null}
    </ClickableRow>
  )
}

function Total({
  label,
  amount,
  comparison,
  currency,
  compared,
}: {
  label: string
  amount: Money
  comparison?: Money
  currency: string
  compared: boolean
}) {
  return (
    <MoneyRow
      label={label}
      amount={amount}
      comparison={comparison}
      currency={currency}
      compared={compared}
      medium
    />
  )
}

function MoneyRow({
  label,
  amount,
  comparison,
  currency,
  compared,
  emphasis,
  medium,
  muted,
  indent,
}: {
  label: string
  amount: Money
  comparison?: Money
  currency: string
  compared: boolean
  emphasis?: boolean
  medium?: boolean
  muted?: boolean
  indent?: boolean
}) {
  const prior = comparison ?? ZERO
  const weight = emphasis ? 'font-semibold' : medium ? 'font-medium' : ''
  const tone = muted ? 'text-muted-foreground' : ''
  return (
    <TableRow className={emphasis ? 'bg-muted/60 hover:bg-muted/60' : medium ? 'border-t' : undefined}>
      <TableCell className={`${weight} ${tone} ${indent ? 'pl-6' : ''}`}>{label}</TableCell>
      <TableCell className={`numeric tabular ${weight} ${tone}`}>
        {formatMoney(amount, currency)}
      </TableCell>
      {compared ? (
        <TableCell className={`numeric tabular text-muted-foreground ${weight}`}>
          {formatMoney(prior, currency)}
        </TableCell>
      ) : null}
      {compared ? (
        <TableCell className={`numeric tabular ${weight}`}>
          {formatMoney(amount.minus(prior), currency)}
        </TableCell>
      ) : null}
    </TableRow>
  )
}
