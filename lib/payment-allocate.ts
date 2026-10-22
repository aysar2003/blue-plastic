import { Decimal, toMoneyString, ZERO } from '@/lib/money'

export type AllocatableInvoice = {
  id: string
  number?: string
  date: string | Date
  balance: string
  overdue?: boolean
}

function asDay(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

/**
 * Overdue invoices first (oldest among those), then the remaining open invoices
 * in the order they were written. Leftover after one invoice continues to the next.
 */
export function sortInvoicesForAllocation<T extends AllocatableInvoice>(invoices: T[]): T[] {
  return [...invoices].sort((a, b) => {
    if (Boolean(a.overdue) !== Boolean(b.overdue)) return a.overdue ? -1 : 1
    const byDate = asDay(a.date).localeCompare(asDay(b.date))
    if (byDate !== 0) return byDate
    return (a.number ?? '').localeCompare(b.number ?? '')
  })
}

/** Split a received amount across invoices in allocation order, until the money runs out. */
export function allocatePaymentToInvoices(
  amount: Decimal.Value,
  invoices: AllocatableInvoice[],
): { invoiceId: string; amount: string }[] {
  let remaining = new Decimal(amount)
  if (!remaining.isFinite() || remaining.lessThanOrEqualTo(0)) return []

  const out: { invoiceId: string; amount: string }[] = []
  for (const invoice of sortInvoicesForAllocation(invoices)) {
    if (remaining.lessThanOrEqualTo(0)) break
    const balance = new Decimal(invoice.balance)
    if (!balance.greaterThan(0)) continue
    const take = Decimal.min(balance, remaining)
    out.push({ invoiceId: invoice.id, amount: toMoneyString(take, 2) })
    remaining = remaining.minus(take)
  }
  return out
}

export function allocationRemainder(amount: Decimal.Value, allocated: { amount: string }[]) {
  const used = allocated.reduce((sum, row) => sum.plus(row.amount), ZERO)
  return new Decimal(amount).minus(used)
}
