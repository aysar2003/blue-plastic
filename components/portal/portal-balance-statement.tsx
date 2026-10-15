import { formatDate, toCalendarDate, type CalendarDate } from '@/lib/date'
import { describeCustomerBalance } from '@/lib/portal-balance'
import { Decimal, formatMoney, toMoneyString, ZERO } from '@/lib/money'
import { EARLIEST_DATE } from '@/lib/report-periods'
import type { StatementEntry } from '@/server/services/receivables.service'
import {
  PortalBalanceSheetTable,
  type PortalBalanceSheetRow,
} from '@/components/portal/portal-balance-sheet-table'

const KIND_LABEL: Record<string, string> = {
  INVOICE: 'Invoice',
  CREDIT_MEMO: 'Credit memo',
  PAYMENT: 'Payment',
  SALES_RECEIPT: 'Sales receipt',
  REFUND_RECEIPT: 'Refund',
  EXPENSE: 'Expense',
  JOURNAL: 'Journal',
  ESTIMATE: 'Estimate',
  QUOTATION: 'Quotation',
}

/**
 * Printable customer balance sheet: invoices (and other AR lines) with a
 * running Balance column that starts at 0 and ends on the closing figure.
 */
export function PortalBalanceStatement({
  companyName,
  customerName,
  currency,
  from,
  to,
  opening,
  entries,
}: {
  companyName: string
  customerName: string
  currency: string
  from: CalendarDate
  to: CalendarDate
  opening: Decimal
  entries: StatementEntry[]
}) {
  const money = (value: Decimal.Value) => formatMoney(value, currency)

  const rows: PortalBalanceSheetRow[] = []
  let running = ZERO

  if (!opening.isZero()) {
    const priorDebit = opening.isPositive() ? opening : ZERO
    const priorCredit = opening.isNegative() ? opening.abs() : ZERO
    running = running.plus(priorDebit).minus(priorCredit)
    rows.push({
      id: 'opening',
      date: from <= EARLIEST_DATE ? null : from,
      dateSort: from <= EARLIEST_DATE ? '0000-01-01' : from,
      number: '—',
      type: 'Opening',
      description: 'Balance brought forward',
      debit: toMoneyString(priorDebit, 2),
      credit: toMoneyString(priorCredit, 2),
      balance: toMoneyString(running, 2),
      invoiceId: null,
      opening: true,
    })
  } else {
    rows.push({
      id: 'opening',
      date: from <= EARLIEST_DATE ? null : from,
      dateSort: from <= EARLIEST_DATE ? '0000-01-01' : from,
      number: '—',
      type: 'Opening',
      description: 'Opening balance',
      debit: '0.00',
      credit: '0.00',
      balance: '0.00',
      invoiceId: null,
      opening: true,
    })
  }

  for (const entry of entries) {
    const debit = new Decimal(entry.charge)
    const credit = new Decimal(entry.credit)
    if (!debit.isZero() || !credit.isZero()) {
      running = running.plus(debit).minus(credit)
    }
    const date = toCalendarDate(entry.date)
    rows.push({
      id: entry.id,
      date,
      dateSort: date,
      number: entry.number,
      type: KIND_LABEL[entry.kind] ?? entry.kind,
      description: entry.description,
      debit: toMoneyString(debit, 2),
      credit: toMoneyString(credit, 2),
      balance: toMoneyString(running, 2),
      invoiceId: entry.kind === 'INVOICE' ? entry.id : null,
    })
  }

  const debitTotal = rows.reduce((sum, row) => sum.plus(row.debit), ZERO)
  const creditTotal = rows.reduce((sum, row) => sum.plus(row.credit), ZERO)
  const closing = running
  const closingCopy = describeCustomerBalance(closing, currency)
  const periodLabel =
    from <= EARLIEST_DATE ? `All dates through ${formatDate(to)}` : `${formatDate(from)} – ${formatDate(to)}`
  const invoiceCount = rows.filter((row) => row.invoiceId).length

  return (
    <div data-report-root className="space-y-4 bg-background text-foreground">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Customer balance sheet
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{customerName}</h2>
          <p className="text-sm text-muted-foreground">{companyName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {invoiceCount} {invoiceCount === 1 ? 'invoice' : 'invoices'} in this period · Balance
            runs from {money(ZERO)} to {money(closing)}
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>{periodLabel}</p>
          <p className="mt-1 font-medium text-foreground">{closingCopy.title}</p>
          <p className="tabular text-lg font-semibold text-foreground">{closingCopy.amountLabel}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Debit</span> = invoices and charges.{' '}
        <span className="font-medium text-foreground">Credit</span> = payments and credit memos.{' '}
        <span className="font-medium text-foreground">Balance</span> starts at {money(ZERO)} and
        updates row by row to the closing amount.
      </p>

      <PortalBalanceSheetTable
        rows={rows}
        currency={currency}
        closingDebit={toMoneyString(debitTotal, 2)}
        closingCredit={toMoneyString(creditTotal, 2)}
        closingBalance={toMoneyString(closing, 2)}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Summary label="Start (Balance)" value={money(ZERO)} />
        <Summary label="Debit total" value={money(debitTotal)} />
        <Summary label="Credit total" value={money(creditTotal)} />
        <Summary label="End (Balance)" value={money(closing)} emphasis />
      </div>

      <p className="text-sm text-muted-foreground">{closingCopy.explanation}</p>

      {entries.length === 0 && opening.isZero() ? (
        <p className="text-sm text-muted-foreground">
          No invoices or other movements in this period. Balance stays at {money(ZERO)}.
        </p>
      ) : null}
    </div>
  )
}

function Summary({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className={`rounded-md border px-3 py-2 ${emphasis ? 'bg-muted/50' : 'bg-card'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`tabular text-base font-semibold ${emphasis ? 'text-foreground' : ''}`}>{value}</p>
    </div>
  )
}
