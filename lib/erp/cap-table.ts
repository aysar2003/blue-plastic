import { Decimal, ZERO } from '@/lib/money'

export type ShareRow = {
  id: string
  name: string
  shares: Decimal
}

export type CapTableRow = ShareRow & {
  ownershipPercent: Decimal
}

const HUNDRED = new Decimal(100)
const TOLERANCE = new Decimal('0.05')

export function totalShares(rows: ShareRow[]): Decimal {
  return rows.reduce((sum, row) => sum.plus(row.shares), ZERO)
}

/** Ownership is always derived from shares so the register cannot drift. */
export function capTable(rows: ShareRow[]): CapTableRow[] {
  const total = totalShares(rows)
  if (total.lessThanOrEqualTo(0)) {
    return rows.map((row) => ({ ...row, ownershipPercent: ZERO }))
  }
  return rows.map((row) => ({
    ...row,
    ownershipPercent: row.shares.dividedBy(total).times(HUNDRED).toDecimalPlaces(4),
  }))
}

export function ownershipAddsToHundred(rows: CapTableRow[], tolerance = TOLERANCE): boolean {
  if (rows.length === 0) return true
  const sum = rows.reduce((acc, row) => acc.plus(row.ownershipPercent), ZERO)
  return sum.minus(HUNDRED).abs().lessThanOrEqualTo(tolerance)
}
