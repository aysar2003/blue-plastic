import Link from 'next/link'

import { ClickableRow } from '@/components/reports/clickable-row'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { JournalSourceType } from '@prisma/client'

import { JOURNAL_SOURCE_LABELS } from '@/lib/accounting-labels'
import { formatDate, toCalendarDate, type CalendarDate } from '@/lib/date'
import { EARLIEST_DATE } from '@/lib/report-periods'
import {
  STATEMENT_VIEW_LABELS,
  forwardBalances,
  signedOpen,
  statementFilterCaption,
  type StatementFilter,
} from '@/lib/customer-statement'

export { forwardBalances, signedOpen }
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
  /** Invoice, payment, sales receipt, and the rest. */
  kind?: string
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
  charges,
  credits,
  entries,
  debitLabel = 'Debit',
  creditLabel = 'Credit',
  books = 'customer',
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
  charges: Decimal
  credits: Decimal
  entries: PaperEntry[]
  debitLabel?: string
  creditLabel?: string
  /** Which books these rows belong to. Decides the account type on every line. */
  books?: 'customer' | 'vendor'
}) {
  const money = (value: Decimal.Value) => formatMoney(value, currency)
  const shownDebit = entries.reduce((sum, entry) => sum.plus(entry.charge), ZERO)
  const shownCredit = entries.reduce((sum, entry) => sum.plus(entry.credit), ZERO)
  /** Net still owing on the rows shown — invoices add, unapplied payments/credits subtract. */
  const shownOpen = entries.reduce((sum, entry) => sum.plus(signedOpen(entry)), ZERO)
  const debitTotal = ledger ? charges : shownDebit
  const creditTotal = ledger ? credits : shownCredit
  const forwarded = forwardBalances(entries, opening)
  // Prefer the ledger running balance on the last row (source of truth from the
  // statement service); fall back to the recomputed forward when empty.
  const balanceTotal = ledger
    ? (entries.at(-1)?.balance ?? forwarded.closing)
    : shownOpen
  const paidTotal = entries.reduce((sum, entry) => sum.plus(paidOf(entry)), ZERO)
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
              <TableHead className="w-36">Transaction</TableHead>
              <TableHead className="w-40">Account type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-28">Due</TableHead>
              <TableHead className="numeric w-32">{debitLabel}</TableHead>
              <TableHead className="numeric w-32">{creditLabel}</TableHead>
              <TableHead className="numeric w-32">Paid</TableHead>
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
                <TableCell />
                <TableCell />
                <TableCell colSpan={2} className="font-medium">
                  Balance brought forward
                </TableCell>
                <TableCell />
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
                books={books}
                carried={forwarded.byId.get(entry.id)}
              />
            ))}
          </TableBody>
          {filter.totals === 'line' ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6} className="font-semibold">
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
                  <span className="block text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Paid total</span>
                  {money(paidTotal)}
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
  books,
  carried,
}: {
  entry: PaperEntry
  currency: string
  ledger: boolean
  mode: StatementFilter['view']
  books: 'customer' | 'vendor'
  carried?: Decimal
}) {
  const money = (value: Decimal.Value) => formatMoney(value, currency)
  const lines = <LineGrid entry={entry} money={money} />
  const tint = kindTint(entry.kind)
  return (
    <>
      <ClickableRow
        href={entry.href}
        className={mode === 'detail' ? `border-t-4 border-card ${tint}` : tint}
      >
        <TableCell className="tabular whitespace-nowrap text-muted-foreground">
          {formatDate(toCalendarDate(entry.date))}
        </TableCell>
        <TableCell className="tabular">
          <Link href={entry.href} className="font-medium underline-offset-4 hover:underline print:no-underline">
            {entry.number}
          </Link>
        </TableCell>
        <TableCell>{transactionName(entry.kind, books)}</TableCell>
        <TableCell className="text-muted-foreground">{books === 'vendor' ? 'Accounts payable' : 'Accounts receivable'}</TableCell>
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
        <TableCell className="numeric tabular">
          {paidLabel(entry, money)}
        </TableCell>
        <TableCell className="numeric tabular font-medium">
          <Link href={entry.href} className="underline-offset-4 hover:underline">
            {money(ledger ? (entry.balance ?? carried ?? ZERO) : signedOpen(entry))}
          </Link>
        </TableCell>
      </ClickableRow>
      {mode === 'detail' && entry.lines.length > 0 ? (
        <TableRow className={tint}>
          <TableCell colSpan={10} className="bg-slate-50/80 px-3 py-2">
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

/** What has been settled on an invoice, bill, or a receipt that was paid at once. */
function paidOf(entry: PaperEntry): Decimal {
  const original = new Decimal(entry.original)
  const open = new Decimal(entry.openAmount)
  if (entry.kind === 'INVOICE' || entry.kind === 'BILL' || entry.kind === 'CREDIT_MEMO' || entry.kind === 'VENDOR_CREDIT') {
    const paid = original.minus(open)
    return paid.greaterThan(0) ? paid : ZERO
  }
  if (entry.kind === 'SALES_RECEIPT' || entry.kind === 'REFUND_RECEIPT' || entry.kind === 'EXPENSE' || entry.kind === 'PAYMENT') {
    return original
  }
  return ZERO
}

function paidLabel(entry: PaperEntry, money: (value: Decimal.Value) => string): string {
  const paid = paidOf(entry)
  if (paid.isZero()) return ''
  return money(paid)
}

/**
 * Soft kind washes. Hover always uses --band so night desks never get a paper
 * wash under light ink (pastel hover:bg-*-100 erased row text on SOM/dark).
 */
const KIND_TINT: Record<string, string> = {
  INVOICE: 'bg-sky-50 hover:bg-[var(--band)] dark:bg-sky-950/45',
  BILL: 'bg-indigo-50 hover:bg-[var(--band)] dark:bg-indigo-950/45',
  PAYMENT: 'bg-emerald-50 hover:bg-[var(--band)] dark:bg-emerald-950/40',
  CREDIT_MEMO: 'bg-amber-50 hover:bg-[var(--band)] dark:bg-amber-950/40',
  VENDOR_CREDIT: 'bg-orange-50 hover:bg-[var(--band)] dark:bg-orange-950/40',
  SALES_RECEIPT: 'bg-teal-50 hover:bg-[var(--band)] dark:bg-teal-950/40',
  EXPENSE: 'bg-lime-50 hover:bg-[var(--band)] dark:bg-lime-950/35',
  REFUND_RECEIPT: 'bg-rose-50 hover:bg-[var(--band)] dark:bg-rose-950/40',
  JOURNAL: 'bg-violet-50 hover:bg-[var(--band)] dark:bg-violet-950/40',
  ESTIMATE: 'bg-stone-100/80 hover:bg-[var(--band)] dark:bg-stone-900/40',
  QUOTATION: 'bg-violet-100/80 hover:bg-[var(--band)] dark:bg-violet-900/40',
  SALES_ORDER: 'bg-orange-100/80 hover:bg-[var(--band)] dark:bg-orange-900/40',
  PURCHASE_ORDER: 'bg-slate-100 hover:bg-[var(--band)] dark:bg-slate-900/45',
}

function kindTint(kind: string | undefined): string {
  return KIND_TINT[kind ?? ''] ?? 'bg-muted/30 hover:bg-muted/50'
}

function transactionName(kind: string | undefined, books: 'customer' | 'vendor'): string {
  if (!kind) return '—'
  if (kind === 'PAYMENT') return books === 'vendor' ? 'Bill payment' : 'Customer payment'
  if (kind === 'ESTIMATE') return 'Estimate'
  if (kind === 'QUOTATION') return 'Quotation'
  if (kind === 'PURCHASE_ORDER') return 'Purchase order'
  if (kind === 'JOURNAL') return 'Journal'
  return JOURNAL_SOURCE_LABELS[kind as JournalSourceType] ?? kind
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
