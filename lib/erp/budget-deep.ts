import { Decimal, ZERO } from '@/lib/money'

/** Calendar months (1–12) overlapping [from, to] inclusive, ordered, unique. */
export function monthsInRange(from: string, to: string): number[] {
  const start = parseYmd(from)
  const end = parseYmd(to)
  if (!start || !end || from > to) return []
  const seen = new Set<number>()
  const out: number[] = []
  let y = start.y
  let m = start.m
  while (y < end.y || (y === end.y && m <= end.m)) {
    if (!seen.has(m)) {
      seen.add(m)
      out.push(m)
    }
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
    if (out.length > 24) break
  }
  return out
}

function parseYmd(value: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

/** Split total across N months; remainder cents on the last month. */
export function spreadAmountAcrossMonths(total: string, monthCount: number): string[] {
  const n = Math.max(1, Math.floor(monthCount))
  const amount = new Decimal(total)
  const base = amount.div(n).toDecimalPlaces(4, Decimal.ROUND_DOWN)
  const parts = Array.from({ length: n }, () => base.toFixed(4))
  const allocated = base.times(n)
  const rem = amount.minus(allocated)
  parts[n - 1] = base.plus(rem).toFixed(4)
  return parts
}

export function inflateAmount(amount: string, percent: number): string {
  const factor = new Decimal(1).plus(new Decimal(percent).div(100))
  return new Decimal(amount).times(factor).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4)
}

/** Sum all months into first month; others zero. */
export function collapseToFirstMonth(amountsByMonth: Record<number, string>): Record<number, string> {
  let total = ZERO
  for (const value of Object.values(amountsByMonth)) {
    total = total.plus(new Decimal(value || '0'))
  }
  const months = Object.keys(amountsByMonth)
    .map(Number)
    .filter((m) => m >= 1 && m <= 12)
    .sort((a, b) => a - b)
  const first = months[0] ?? 1
  const out: Record<number, string> = {}
  for (const m of months) out[m] = m === first ? total.toFixed(4) : '0.0000'
  if (!(first in out)) out[first] = total.toFixed(4)
  return out
}

/** Spread a single account's total evenly across the given months. */
export function spreadEvenlyAcross(total: string, months: number[]): Record<number, string> {
  const parts = spreadAmountAcrossMonths(total, months.length || 1)
  const out: Record<number, string> = {}
  months.forEach((m, i) => {
    out[m] = parts[i] ?? '0.0000'
  })
  return out
}

export type BudgetCsvRow = {
  accountCode: string
  month: number
  amount: string
  className: string | null
  line: number
}

export type BudgetCsvIssue = { line: number; message: string }

/** Parse budget CSV rows: accountCode, month (1-12 or YYYY-MM), amount, optional className. */
export function parseBudgetCsvRows(
  rows: Record<string, string>[],
): { rows: BudgetCsvRow[]; issues: BudgetCsvIssue[] } {
  const out: BudgetCsvRow[] = []
  const issues: BudgetCsvIssue[] = []
  rows.forEach((row, index) => {
    const line = index + 2
    const accountCode = (row.accountCode ?? row.account ?? row.code ?? '').trim()
    const amountRaw = (row.amount ?? row.budget ?? '').trim()
    const className = (row.className ?? row.class ?? row.department ?? '').trim() || null
    const monthRaw = (row.month ?? row.period ?? '').trim()
    if (!accountCode && !amountRaw && !monthRaw) return
    if (!accountCode) {
      issues.push({ line, message: 'accountCode is required' })
      return
    }
    const month = parseBudgetMonth(monthRaw)
    if (month == null) {
      issues.push({ line, message: 'month must be 1–12 or YYYY-MM' })
      return
    }
    let amount: Decimal
    try {
      amount = new Decimal(amountRaw || '0')
    } catch {
      issues.push({ line, message: 'amount must be a number' })
      return
    }
    if (!amount.isFinite()) {
      issues.push({ line, message: 'amount must be a number' })
      return
    }
    out.push({
      accountCode,
      month,
      amount: amount.toFixed(4),
      className,
      line,
    })
  })
  return { rows: out, issues }
}

export function parseBudgetMonth(raw: string): number | null {
  if (!raw) return null
  if (/^\d{1,2}$/.test(raw)) {
    const n = Number(raw)
    return n >= 1 && n <= 12 ? n : null
  }
  const ym = /^(\d{4})-(\d{2})$/.exec(raw)
  if (ym) {
    const n = Number(ym[2])
    return n >= 1 && n <= 12 ? n : null
  }
  return null
}

export function budgetCellKey(accountId: string, month: number, trackingCategoryId: string | null): string {
  return `${accountId}|${month}|${trackingCategoryId ?? ''}`
}

/** True when proposed spend would exceed approved budget for the month. */
export function wouldExceedBudget(input: {
  budgeted: string
  actualPosted: string
  proposed: string
}): boolean {
  const budget = new Decimal(input.budgeted)
  if (budget.lessThanOrEqualTo(0)) return false
  const used = new Decimal(input.actualPosted).plus(new Decimal(input.proposed))
  return used.greaterThan(budget)
}

export const BUDGET_LINE_ACCOUNT_TYPES = [
  'REVENUE',
  'COGS',
  'EXPENSE',
  'ASSET',
  'LIABILITY',
  'EQUITY',
] as const

export const BUDGET_CONTROL_ACCOUNT_TYPES = ['COGS', 'EXPENSE'] as const
