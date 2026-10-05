import { Decimal, toMoneyString, ZERO } from '@/lib/money'
import type { CalendarDate } from '@/lib/date'

/**
 * The money bar on the vendor list — mirror of the customer bands, on the
 * payable side: open purchase orders, overdue bills, open bills, recent payments.
 */
export type VendorBandKey = 'orders' | 'overdue' | 'open' | 'paid'

export type PurchaseBandDocument = {
  vendorId: string
  type: 'BILL' | 'VENDOR_CREDIT' | 'PURCHASE_ORDER' | string
  status: string
  total: string
  applied: string
  due: CalendarDate | null
  date: CalendarDate
}

export type PurchaseBandPayment = {
  vendorId: string
  status: string
  amount: string
  date: CalendarDate
}

export type VendorBand = {
  key: VendorBandKey
  amount: string
  count: number
  extra: number
  holders: number
  vendorIds: string[]
}

export type VendorLedgerBalance = {
  vendorId: string
  /** Natural payables balance: positive means the business owes the vendor. */
  balance: string
}

const money = (value: Decimal) => toMoneyString(value, 2)

const remaining = (row: PurchaseBandDocument) =>
  Decimal.max(new Decimal(row.total).minus(row.applied), ZERO)

function push(ids: Set<string>, id: string) {
  ids.add(id)
}

export function vendorBands(
  documents: PurchaseBandDocument[],
  payments: PurchaseBandPayment[],
  asOf: CalendarDate,
  recentFrom: CalendarDate,
  balances: VendorLedgerBalance[] = [],
): Record<VendorBandKey, VendorBand> {
  const orders = { amount: ZERO, count: 0, ids: new Set<string>() }
  const overdue = { amount: ZERO, count: 0, ids: new Set<string>(), byVendor: new Map<string, Decimal>() }
  const open = { amount: ZERO, count: 0, credits: 0, ids: new Set<string>() }
  const paid = { amount: ZERO, count: 0, ids: new Set<string>() }

  for (const row of documents) {
    if (row.type === 'PURCHASE_ORDER' && (row.status === 'DRAFT' || row.status === 'OPEN' || row.status === 'PARTIAL')) {
      orders.amount = orders.amount.plus(row.total)
      orders.count += 1
      push(orders.ids, row.vendorId)
      continue
    }

    if (row.status !== 'OPEN' && row.status !== 'PARTIAL') continue
    const balance = remaining(row)
    if (!balance.greaterThan(0)) continue

    if (row.type === 'VENDOR_CREDIT') {
      open.credits += 1
      push(open.ids, row.vendorId)
      continue
    }

    if (row.type !== 'BILL') continue
    const due = row.due ?? row.date
    if (due < asOf) {
      overdue.amount = overdue.amount.plus(balance)
      overdue.count += 1
      push(overdue.ids, row.vendorId)
      overdue.byVendor.set(row.vendorId, (overdue.byVendor.get(row.vendorId) ?? ZERO).plus(balance))
    } else {
      open.amount = open.amount.plus(balance)
      open.count += 1
      push(open.ids, row.vendorId)
    }
  }

  for (const payment of payments) {
    if (payment.status === 'VOID') continue
    if (payment.date < recentFrom || payment.date > asOf) continue
    const amount = new Decimal(payment.amount)
    if (!amount.greaterThan(0)) continue
    paid.amount = paid.amount.plus(amount)
    paid.count += 1
    push(paid.ids, payment.vendorId)
  }

  let holders = open.ids.size
  if (balances.length > 0) {
    let current = ZERO
    const owing = new Set<string>()
    for (const row of balances) {
      const late = overdue.byVendor.get(row.vendorId) ?? ZERO
      const now = new Decimal(row.balance).minus(late)
      if (!now.greaterThan(0)) continue
      current = current.plus(now)
      owing.add(row.vendorId)
      push(open.ids, row.vendorId)
    }
    open.amount = current
    holders = owing.size
  }

  return {
    orders: {
      key: 'orders',
      amount: money(orders.amount),
      count: orders.count,
      extra: 0,
      holders: orders.ids.size,
      vendorIds: [...orders.ids],
    },
    overdue: {
      key: 'overdue',
      amount: money(overdue.amount),
      count: overdue.count,
      extra: 0,
      holders: overdue.ids.size,
      vendorIds: [...overdue.ids],
    },
    open: {
      key: 'open',
      amount: money(open.amount),
      count: open.count,
      extra: open.credits,
      holders,
      vendorIds: [...open.ids],
    },
    paid: {
      key: 'paid',
      amount: money(paid.amount),
      count: paid.count,
      extra: 0,
      holders: paid.ids.size,
      vendorIds: [...paid.ids],
    },
  }
}

export function vendorBandDetail(band: VendorBand): string {
  if (band.key === 'orders') return countPhrase(band.count, 'purchase order', 'purchase orders')
  if (band.key === 'overdue') return countPhrase(band.count, 'overdue bill', 'overdue bills')
  if (band.key === 'paid') return countPhrase(band.count, 'recently paid', 'recently paid')
  if (band.count === 0 && band.extra === 0) {
    return countPhrase(band.holders, 'open balance', 'open balances')
  }
  const bills = countPhrase(band.count, 'open bill', 'open bills')
  if (band.extra === 0) return bills
  const credits = countPhrase(band.extra, 'credit', 'credits')
  if (band.count === 0) return credits
  return `${bills} and ${credits}`
}

function countPhrase(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function isVendorBandKey(value: string | undefined): value is VendorBandKey {
  return value === 'orders' || value === 'overdue' || value === 'open' || value === 'paid'
}
