import { toDate, type CalendarDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'

export type LoanAgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+'

export function daysPastDue(dueDate: CalendarDate, asOf: CalendarDate): number {
  return Math.round((toDate(asOf).getTime() - toDate(dueDate).getTime()) / 86_400_000)
}

export function loanAgingBucket(dueDate: CalendarDate, asOf: CalendarDate): LoanAgingBucket {
  const days = daysPastDue(dueDate, asOf)
  if (days <= 0) return 'current'
  if (days <= 30) return '1-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

export type AgingLine = {
  dueDate: CalendarDate
  paidAt?: Date | string | null
  principalDue: Decimal.Value
  interestDue: Decimal.Value
}

export function overdueAgingTotals(lines: AgingLine[], asOf: CalendarDate) {
  const buckets: Record<LoanAgingBucket, Decimal> = {
    current: ZERO,
    '1-30': ZERO,
    '31-60': ZERO,
    '61-90': ZERO,
    '90+': ZERO,
  }
  let overdueCount = 0
  for (const line of lines) {
    if (line.paidAt) continue
    const total = new Decimal(line.principalDue).plus(line.interestDue)
    const bucket = loanAgingBucket(line.dueDate, asOf)
    buckets[bucket] = buckets[bucket].plus(total)
    if (bucket !== 'current') overdueCount += 1
  }
  return {
    overdueCount,
    buckets: {
      current: buckets.current.toFixed(4),
      '1-30': buckets['1-30'].toFixed(4),
      '31-60': buckets['31-60'].toFixed(4),
      '61-90': buckets['61-90'].toFixed(4),
      '90+': buckets['90+'].toFixed(4),
    },
  }
}
