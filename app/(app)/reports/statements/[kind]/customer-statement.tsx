import Link from 'next/link'

import { ClickableRow } from '@/components/reports/clickable-row'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, toCalendarDate, type CalendarDate } from '@/lib/date'
import { EARLIEST_DATE } from '@/lib/report-periods'
import {
  STATEMENT_VIEW_LABELS,
  statementFilterCaption,
  type StatementFilter,
} from '@/lib/customer-statement'
import { letterheadLines, type LetterheadSource } from '@/lib/letterhead'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import type { StatementEntry, StatementItem } from '@/server/services/receivables.service'

/** The columns the statement paper reads. A vendor row fits this too. */
export type PaperEntry = {
  id: string
  number: string
  date: Date
  dueDate: Date | null
  description: string
  charge: Decimal
  credit: Decimal
  openAmount: Decimal
  original: Decimal
  balance: Decimal
  lines: StatementItem[]
  href: string
}

export function CustomerStatement({
  currency,
  customer,
  from,
  to,
  filter,
  ledger,
  caption,
  opening,
  closing,
  charges,
  credits,
  entries,
  debitLabel = 'Debit',
  creditLabel = 'Credit',
}: {
  currency: string
  customer: {
    displayName: string
    companyName: string | null
    email: string | null
    phone: string | null
    address: string[]
  }
  from: CalendarDate
  to: CalendarDate
  filter: Pick<StatementFilter, 'view' | 'totals'>
  /** Full unfiltered statement. A type or status filter turns this off. */
  ledger: boolean
  caption: string
  opening: Decimal
  closing: Decimal
  charges: Decimal
  credits: Decimal
  entries: PaperEntry[]
  debitLabel?: string
  creditLabel?: string
}) {
  const money = (value: Decimal.Value) => formatMoney(value, currency)
  const shownDebit = entries.reduce((sum, entry) => sum.plus(entry.charge), ZERO)
  const shownCredit = entries.reduce((sum, entry) => sum.plus(entry.credit), ZERO)
  const shownOpen = entries.reduce((sum, entry) => sum.plus(entry.openAmount), ZERO)
  const debitTotal = ledger ? charges : shownDebit
  const creditTotal = ledger ? credits : shownCredit
  const balanceTotal = ledger ? closing : shownOpen
  const periodLabel = from <= EARLIEST_DATE ? `All dates through ${formatDate(to)}` : `${formatDate(from)} to ${formatDate(to)}`

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Statement for</p>
          <p className="text-base font-semibold">{customer.displayName}</p>
          {customer.companyName && customer.companyName !== customer.displayName ? (
            <p className="text-muted-foreground">{customer.companyName}</p>
          ) : null}
          {customer.address.map((line) => (
            <p key={line} className="text-muted-foreground">
              {line}
            </p>
          ))}
          {customer.phone ? <p className="text-muted-foreground">{customer.phone}</p> : null}
          {customer.email ? <p className="text-muted-foreground">{customer.email}</p> : null}
        </div>
        <div className="text-right text-sm">
          <p className="text-muted-foreground">{periodLabel}</p>
          <p className="text-muted-foreground">{STATEMENT_VIEW_LABELS[filter.view]}</p>
        </div>
      </div>

      {caption ? <p className="mb-3 text-sm text-muted-foreground">{caption}</p> : null}

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              <TableHead className="w-36">Document</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-28">Due</TableHead>
              <TableHead className="numeric w-32">{debitLabel}</TableHead>
              <TableHead className="numeric w-32">{creditLabel}</TableHead>
              <TableHead className="numeric w-32">{ledger ? 'Balance' : 'Balance due'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledger ? (
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                  {from <= EARLIEST_DATE ? '—' : formatDate(from)}
                </TableCell>
                <TableCell />
                <TableCell colSpan={2} className="font-medium">
                  Balance brought forward
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="numeric tabular font-medium">{money(opening)}</TableCell>
              </TableRow>
            ) : null}

            {entries.map((entry) => (
              <StatementRows
                key={entry.id}
                entry={entry}
                currency={currency}
                ledger={ledger}
                mode={filter.view}
              />
            ))}
          </TableBody>
          {filter.totals === 'line' ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-semibold">
                  {ledger ? `Balance at ${formatDate(to)}` : 'Rows shown'}
                </TableCell>
                <TableCell className="numeric tabular font-semibold">
                  <span className="block text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">{debitLabel} total</span>
                  {money(debitTotal)}
                </TableCell>
                <TableCell className="numeric tabular font-semibold">
                  <span className="block text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">{creditLabel} total</span>
                  {money(creditTotal)}
                </TableCell>
                <TableCell className="numeric tabular font-semibold">
                  <span className="block text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Balance</span>
                  {money(balanceTotal)}
                </TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </Card>

      {filter.totals === 'cards' ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Summary label="Opening balance" value={money(opening)} />
          <Summary label={`${debitLabel} total`} value={money(debitTotal)} />
          <Summary label={`${creditLabel} total`} value={money(creditTotal)} />
          <Summary label="Balance" value={money(balanceTotal)} emphasis />
        </div>
      ) : null}

      {filter.totals === 'band' ? (
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
          <Band label="Opening balance" value={money(opening)} />
          <Band label={`${debitLabel} total`} value={money(debitTotal)} />
          <Band label={`${creditLabel} total`} value={money(creditTotal)} />
          <Band label="Balance" value={money(balanceTotal)} emphasis />
        </div>
      ) : null}

      {filter.totals === 'stack' ? (
        <div className="mt-4 ml-auto w-full max-w-xs overflow-hidden rounded-xl border bg-card">
          <TotalLine label="Opening balance" value={money(opening)} />
          <TotalLine label={`${debitLabel} total`} value={money(debitTotal)} />
          <TotalLine label={`${creditLabel} total`} value={money(creditTotal)} />
          <TotalLine label="Balance" value={money(balanceTotal)} emphasis />
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {ledger
            ? 'Nothing moved in this period. The balance brought forward is the balance carried forward.'
            : 'Nothing matches that filter for these dates.'}
        </p>
      ) : null}
    </>
  )
}

function StatementRows({
  entry,
  currency,
  ledger,
  mode,
}: {
  entry: PaperEntry
  currency: string
  ledger: boolean
  mode: StatementFilter['view']
}) {
  const money = (value: Decimal.Value) => formatMoney(value, currency)
  const lines = <LineGrid entry={entry} money={money} />
  return (
    <>
      <ClickableRow href={entry.href} className={mode === 'detail' ? 'border-t-4 border-card' : undefined}>
        <TableCell className="tabular whitespace-nowrap text-muted-foreground">
          {formatDate(toCalendarDate(entry.date))}
        </TableCell>
        <TableCell className="tabular">
          <Link href={entry.href} className="font-medium underline-offset-4 hover:underline print:no-underline">
            {entry.number}
          </Link>
        </TableCell>
        <TableCell className="text-muted-foreground">
          <Link href={entry.href} className="underline-offset-4 hover:underline">
            {entry.description}
          </Link>
          {entry.charge.isZero() && entry.credit.isZero() && !entry.original.isZero() ? (
            <span className="ml-2 tabular text-foreground">{money(entry.original)}</span>
          ) : null}
          {mode === 'regular' && entry.lines.length > 1 ? (
            <span className="ml-2 text-xs text-muted-foreground">{entry.lines.length} lines</span>
          ) : null}
          {mode === 'arrow' && entry.lines.length > 0 ? (
            <details className="statement-lines mt-1">
              <summary className="cursor-pointer list-none text-xs font-medium text-primary [&::-webkit-details-marker]:hidden">
                ▸ {entry.lines.length} {entry.lines.length === 1 ? 'line' : 'lines'}
              </summary>
              {lines}
            </details>
          ) : null}
        </TableCell>
        <TableCell className="tabular whitespace-nowrap text-muted-foreground">
          {entry.dueDate ? formatDate(toCalendarDate(entry.dueDate)) : '—'}
        </TableCell>
        <TableCell className="numeric tabular">
          {entry.charge.isZero() ? '' : <Link href={entry.href} className="underline-offset-4 hover:underline">{money(entry.charge)}</Link>}
        </TableCell>
        <TableCell className="numeric tabular">
          {entry.credit.isZero() ? '' : <Link href={entry.href} className="underline-offset-4 hover:underline">{money(entry.credit)}</Link>}
        </TableCell>
        <TableCell className="numeric tabular font-medium">
          <Link href={entry.href} className="underline-offset-4 hover:underline">
            {money(ledger ? entry.balance : entry.openAmount)}
          </Link>
        </TableCell>
      </ClickableRow>
      {mode === 'detail' && entry.lines.length > 0 ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={7} className="bg-slate-50/80 px-3 py-2">
            <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-md text-xs">
              <thead>
                <tr className="ledger-head text-left text-[0.65rem] font-semibold uppercase tracking-wide">
                  <th className="px-2 py-1.5 font-semibold">Item</th>
                  <th className="w-20 px-2 py-1.5 text-right font-semibold">Qty</th>
                  <th className="w-28 px-2 py-1.5 text-right font-semibold">Price</th>
                  <th className="w-28 px-2 py-1.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((item, index) => (
                  <tr key={`${entry.id}-${index}`} className={index % 2 === 0 ? 'ledger-row' : 'ledger-row-alt'}>
                    <td className="px-2 py-1 text-slate-800">{item.description}</td>
                    <td className="numeric tabular px-2 py-1 text-right">{item.quantity ? plainQty(item.quantity) : ''}</td>
                    <td className="numeric tabular px-2 py-1 text-right">{item.rate ? money(item.rate) : ''}</td>
                    <td className="numeric tabular px-2 py-1 text-right font-medium">{money(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

function LineGrid({
  entry,
  money,
}: {
  entry: PaperEntry
  money: (value: Decimal.Value) => string
}) {
  return (
    <div className="mt-1 max-w-xl border-l-2 border-primary/30 pl-3">
      <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_5.5rem_6rem] gap-x-3 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Name</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Price</span>
        <span className="text-right">Amount</span>
      </div>
      {entry.lines.map((item, index) => (
        <div
          key={`${entry.id}-${index}`}
          className="grid grid-cols-[minmax(0,1fr)_3.5rem_5.5rem_6rem] gap-x-3 py-0.5 text-xs"
        >
          <Link href={entry.href} className="truncate text-muted-foreground underline-offset-4 hover:underline">
            {item.description}
          </Link>
          <span className="numeric tabular text-right">{item.quantity ? plainQty(item.quantity) : ''}</span>
          <span className="numeric tabular text-right">{item.rate ? money(item.rate) : ''}</span>
          <Link href={entry.href} className="numeric tabular text-right underline-offset-4 hover:underline">
            {money(item.amount)}
          </Link>
        </div>
      ))}
    </div>
  )
}

function Summary({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`tabular mt-0.5 ${emphasis ? 'text-lg font-semibold' : 'text-sm font-medium'}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function Band({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`bg-card px-4 py-3 ${emphasis ? 'bg-primary/10' : ''}`}>
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`tabular mt-0.5 ${emphasis ? 'text-lg font-semibold' : 'text-sm font-medium'}`}>{value}</p>
    </div>
  )
}

function TotalLine({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 px-4 py-2 ${emphasis ? 'border-t bg-primary/10' : ''}`}>
      <span className={`text-sm ${emphasis ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`tabular ${emphasis ? 'text-base font-semibold' : 'text-sm'}`}>{value}</span>
    </div>
  )
}

function plainQty(value: string): string {
  const amount = new Decimal(value)
  return amount.mod(1).isZero() ? amount.toFixed(0) : amount.toFixed(2)
}

export function statementEmailBody(input: {
  orgName: string
  organization?: LetterheadSource
  customerName: string
  from: CalendarDate
  to: CalendarDate
  filter: StatementFilter
  currency: string
  opening: Decimal
  closing: Decimal
  entries: StatementEntry[]
}): string {
  const money = (value: Decimal.Value) => formatMoney(value, input.currency)
  const caption = statementFilterCaption(input.filter)
  const lines = input.entries.flatMap((entry) => {
    const row = [
      formatDate(toCalendarDate(entry.date)),
      entry.number,
      entry.description,
      entry.charge.isZero() ? '' : `Debit ${money(entry.charge)}`,
      entry.credit.isZero() ? '' : `Credit ${money(entry.credit)}`,
    ]
      .filter(Boolean)
      .join('  ')
    if (input.filter.view !== 'detail' || entry.lines.length === 0) return [row]
    const items = [
      '    Name  Qty  Price  Amount',
      ...entry.lines.map(
        (item) =>
          `    ${item.description}  ${item.quantity ? plainQty(item.quantity) : ''}  ${item.rate ? money(item.rate) : ''}  ${money(item.amount)}`,
      ),
    ]
    return [row, ...items]
  })
  const company = input.organization ? letterheadLines(input.organization) : [`Statement from ${input.orgName}`]
  return [
    ...company,
    input.customerName,
    `${formatDate(input.from)} to ${formatDate(input.to)}`,
    STATEMENT_VIEW_LABELS[input.filter.view],
    caption,
    '',
    `Opening balance: ${money(input.opening)}`,
    ...lines,
    '',
    `Amount due: ${money(input.closing)}`,
  ]
    .filter((line) => line !== '')
    .join('\n')
}
