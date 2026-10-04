import { Decimal, toMoneyString, ZERO } from '@/lib/money'
import type { CalendarDate } from '@/lib/date'

/**
 * The money bar on the customer list.
 *
 * Each figure is a position the business can act on: a quotation not yet
 * accepted, an invoice past its due date, an invoice that is open but not yet
 * due, and money that actually arrived in the last 30 days. A draft invoice is
 * not owed, and a void is not a sale.
 */
export type BandKey = 'estimates' | 'overdue' | 'open' | 'paid'

export type SalesBandDocument = {
  customerId: string
  type: 'INVOICE' | 'ESTIMATE' | 'CREDIT_MEMO' | string
  status: string
  total: string
  applied: string
  /** Due date, or the document date when the invoice has no due date. */
  due: CalendarDate | null
  date: CalendarDate
}

export type SalesBandPayment = {
  customerId: string
  status: string
  amount: string
  date: CalendarDate
}

export type CustomerBand = {
  key: BandKey
  amount: string
  count: number
  /** Extra documents counted in the label, such as open credits beside open invoices. */
  extra: number
  /** Customers who currently owe something that is not yet overdue. */
  holders: number
  customerIds: string[]
}

export type CustomerLedgerBalance = {
  customerId: string
  /** Natural receivables balance: positive means the customer owes the business. */
  balance: string
}

const money = (value: Decimal) => toMoneyString(value, 2)

const remaining = (row: SalesBandDocument) =>
  Decimal.max(new Decimal(row.total).minus(row.applied), ZERO)

function push(ids: Set<string>, id: string) {
  ids.add(id)
}

export function customerBands(
  documents: SalesBandDocument[],
  payments: SalesBandPayment[],
  asOf: CalendarDate,
  recentFrom: CalendarDate,
  /**
   * Ledger balances. When present, the open figure is what each customer owes
   * after overdue invoices are taken out, so an opening balance with no invoice
   * still appears on the bar.
   */
  balances: CustomerLedgerBalance[] = [],
): Record<BandKey, CustomerBand> {
  const estimates = { amount: ZERO, count: 0, ids: new Set<string>() }
  const overdue = { amount: ZERO, count: 0, ids: new Set<string>(), byCustomer: new Map<string, Decimal>() }
  const open = { amount: ZERO, count: 0, credits: 0, ids: new Set<string>() }
  const paid = { amount: ZERO, count: 0, ids: new Set<string>() }

  for (const row of documents) {
    if (row.type === 'ESTIMATE' && (row.status === 'DRAFT' || row.status === 'ACCEPTED')) {
      estimates.amount = estimates.amount.plus(row.total)
      estimates.count += 1
      push(estimates.ids, row.customerId)
      continue
    }

    if (row.status !== 'OPEN' && row.status !== 'PARTIAL') continue
    const balance = remaining(row)
    if (!balance.greaterThan(0)) continue

    if (row.type === 'CREDIT_MEMO') {
      open.credits += 1
      push(open.ids, row.customerId)
      continue
    }

    if (row.type !== 'INVOICE') continue
    const due = row.due ?? row.date
    if (due < asOf) {
      overdue.amount = overdue.amount.plus(balance)
      overdue.count += 1
      push(overdue.ids, row.customerId)
      overdue.byCustomer.set(row.customerId, (overdue.byCustomer.get(row.customerId) ?? ZERO).plus(balance))
    } else {
      open.amount = open.amount.plus(balance)
      open.count += 1
      push(open.ids, row.customerId)
    }
  }

  for (const payment of payments) {
    if (payment.status === 'VOID') continue
    if (payment.date < recentFrom || payment.date > asOf) continue
    const amount = new Decimal(payment.amount)
    if (!amount.greaterThan(0)) continue
    paid.amount = paid.amount.plus(amount)
    paid.count += 1
    push(paid.ids, payment.customerId)
  }

  let holders = open.ids.size
  if (balances.length > 0) {
    let current = ZERO
    const owing = new Set<string>()
    for (const row of balances) {
      const late = overdue.byCustomer.get(row.customerId) ?? ZERO
      const now = new Decimal(row.balance).minus(late)
      if (!now.greaterThan(0)) continue
      current = current.plus(now)
      owing.add(row.customerId)
      push(open.ids, row.customerId)
    }
    open.amount = current
    holders = owing.size
  }

  return {
    estimates: {
      key: 'estimates',
      amount: money(estimates.amount),
      count: estimates.count,
      extra: 0,
      holders: estimates.ids.size,
      customerIds: [...estimates.ids],
    },
    overdue: {
      key: 'overdue',
      amount: money(overdue.amount),
      count: overdue.count,
      extra: 0,
      holders: overdue.ids.size,
      customerIds: [...overdue.ids],
    },
    open: {
      key: 'open',
      amount: money(open.amount),
      count: open.count,
      extra: open.credits,
      holders,
      customerIds: [...open.ids],
    },
    paid: {
      key: 'paid',
      amount: money(paid.amount),
      count: paid.count,
      extra: 0,
      holders: paid.ids.size,
      customerIds: [...paid.ids],
    },
  }
}

export function bandDetail(band: CustomerBand): string {
  if (band.key === 'estimates') return countPhrase(band.count, 'estimate', 'estimates')
  if (band.key === 'overdue') return countPhrase(band.count, 'overdue invoice', 'overdue invoices')
  if (band.key === 'paid') return countPhrase(band.count, 'recently paid', 'recently paid')
  if (band.count === 0 && band.extra === 0) {
    return countPhrase(band.holders, 'open balance', 'open balances')
  }
  const invoices = countPhrase(band.count, 'open invoice', 'open invoices')
  if (band.extra === 0) return invoices
  const credits = countPhrase(band.extra, 'credit', 'credits')
  if (band.count === 0) return credits
  return `${invoices} and ${credits}`
}

function countPhrase(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}
