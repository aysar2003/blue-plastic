import { ZERO } from '@/lib/money'

/** Quotations that belong on a project's combined paper. Void / declined stay off. */
const SKIP_STATUSES = new Set(['VOID', 'DECLINED'])

export function isPrintableProjectQuotation(row: { type: string; status: string }) {
  return row.type === 'QUOTATION' && !SKIP_STATUSES.has(row.status)
}

/** Oldest first so job sections print in the order they were quoted. */
export function sortProjectQuotations<T extends { date: string; number: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number))
}

export function printableProjectQuotations<
  T extends { id: string; type: string; status: string; date: string; number: string },
>(sales: T[]): T[] {
  return sortProjectQuotations(sales.filter(isPrintableProjectQuotation))
}

/**
 * Running job total: quotation 1 is itself; quotation 2 adds quotation 1, and
 * so on, so the last paper carries every quoted amount.
 */
export function runningQuotationTotals(
  totals: readonly string[],
): { previousQuotationsTotal: string; runningTotal: string }[] {
  let previous = ZERO
  return totals.map((total) => {
    const previousQuotationsTotal = previous.toFixed(4)
    const runningTotal = previous.plus(total).toFixed(4)
    previous = previous.plus(total)
    return { previousQuotationsTotal, runningTotal }
  })
}

export function hasPreviousQuotations(previousQuotationsTotal: string | null | undefined) {
  return previousQuotationsTotal != null && previousQuotationsTotal !== '' && Number(previousQuotationsTotal) > 0.004
}
