import { Decimal, ZERO } from '@/lib/money'

/** Royalty = child sales × royalty % / 100. */
export function franchiseRoyaltyAmount(salesTotal: Decimal.Value, royaltyPercent: Decimal.Value | null): Decimal {
  if (royaltyPercent == null) return ZERO
  const pct = new Decimal(royaltyPercent)
  if (pct.lessThanOrEqualTo(0)) return ZERO
  return new Decimal(salesTotal).times(pct).div(100).toDecimalPlaces(4)
}

export function isFranchisee(royaltyPercent: Decimal.Value | null | undefined): boolean {
  if (royaltyPercent == null) return false
  return new Decimal(royaltyPercent).greaterThan(0)
}

export type RoyaltyStatementRow = {
  name: string
  royaltyPercent: string
  sales: string
  royaltyDue: string
}

export function royaltyStatementCsv(rows: RoyaltyStatementRow[]): string {
  const header = 'franchisee,royaltyPercent,sales,royaltyDue'
  const body = rows.map(
    (row) =>
      `${csvEscape(row.name)},${row.royaltyPercent},${row.sales},${row.royaltyDue}`,
  )
  return [header, ...body].join('\n')
}

export type BrandPnlRow = {
  income: Decimal.Value
  expense: Decimal.Value
  net: Decimal.Value
  royaltyDue: Decimal.Value
}

export function brandPnlRollup(rows: BrandPnlRow[]): {
  income: string
  expense: string
  net: string
  royaltyDue: string
} {
  let income = ZERO
  let expense = ZERO
  let net = ZERO
  let royaltyDue = ZERO
  for (const row of rows) {
    income = income.plus(row.income)
    expense = expense.plus(row.expense)
    net = net.plus(row.net)
    royaltyDue = royaltyDue.plus(row.royaltyDue)
  }
  return {
    income: income.toFixed(4),
    expense: expense.toFixed(4),
    net: net.toFixed(4),
    royaltyDue: royaltyDue.toFixed(4),
  }
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}