import { Decimal, ZERO } from '@/lib/money'

/** Clamp ownership percent to 0–100. */
export function normalizeOwnershipPercent(value: string | number | null | undefined): Decimal {
  const n = typeof value === 'string' ? Number(value) : Number(value ?? 100)
  if (!Number.isFinite(n)) return new Decimal(100)
  if (n <= 0) return ZERO
  if (n >= 100) return new Decimal(100)
  return new Decimal(n).toDecimalPlaces(4)
}

/**
 * Parent share of a subsidiary total.
 * Parent company itself uses 100% (caller passes ownership 100 for root).
 */
export function ownedShare(total: Decimal.Value, ownershipPercent: Decimal.Value): Decimal {
  const pct = normalizeOwnershipPercent(ownershipPercent.toString())
  return new Decimal(total).times(pct).div(100).toDecimalPlaces(4)
}

/** Minority / NCI = remainder not owned by the group. */
export function minorityInterest(total: Decimal.Value, ownershipPercent: Decimal.Value): Decimal {
  const owned = ownedShare(total, ownershipPercent)
  return new Decimal(total).minus(owned).toDecimalPlaces(4)
}

export type ConsolCompanyRow = {
  orgId: string
  isParent: boolean
  ownershipPercent: Decimal
  income: Decimal
  expense: Decimal
  net: Decimal
  assets: Decimal
  liabilities: Decimal
  equity: Decimal
}

export type ConsolRollup = {
  income: Decimal
  expense: Decimal
  net: Decimal
  assets: Decimal
  liabilities: Decimal
  equity: Decimal
  nci: Decimal
}

/** Sum subsidiary rows at ownership %; parent at 100%; NCI from sub equity remainders. */
export function rollupWithOwnership(rows: ConsolCompanyRow[]): ConsolRollup {
  let income = ZERO
  let expense = ZERO
  let net = ZERO
  let assets = ZERO
  let liabilities = ZERO
  let equity = ZERO
  let nci = ZERO

  for (const row of rows) {
    const pct = row.isParent ? new Decimal(100) : row.ownershipPercent
    income = income.plus(ownedShare(row.income, pct))
    expense = expense.plus(ownedShare(row.expense, pct))
    net = net.plus(ownedShare(row.net, pct))
    assets = assets.plus(ownedShare(row.assets, pct))
    liabilities = liabilities.plus(ownedShare(row.liabilities, pct))
    equity = equity.plus(ownedShare(row.equity, pct))
    if (!row.isParent) {
      nci = nci.plus(minorityInterest(row.equity, pct))
    }
  }

  return {
    income: income.toDecimalPlaces(4),
    expense: expense.toDecimalPlaces(4),
    net: net.toDecimalPlaces(4),
    assets: assets.toDecimalPlaces(4),
    liabilities: liabilities.toDecimalPlaces(4),
    equity: equity.toDecimalPlaces(4),
    nci: nci.toDecimalPlaces(4),
  }
}

/** Suggest IC pairs: same absolute debit total, different orgs, dates within windowDays. */
export function suggestIcPairs(
  journals: {
    id: string
    orgId: string
    date: string
    amount: Decimal.Value
  }[],
  windowDays = 7,
): { aId: string; bId: string; amount: string }[] {
  const pairs: { aId: string; bId: string; amount: string }[] = []
  const used = new Set<string>()

  const sorted = [...journals].sort((a, b) => a.date.localeCompare(b.date))
  for (let i = 0; i < sorted.length; i += 1) {
    const left = sorted[i]!
    if (used.has(left.id)) continue
    const leftAmt = new Decimal(left.amount).abs()
    for (let j = i + 1; j < sorted.length; j += 1) {
      const right = sorted[j]!
      if (used.has(right.id)) continue
      if (right.orgId === left.orgId) continue
      const dayDiff = Math.abs(
        (Date.parse(right.date) - Date.parse(left.date)) / (1000 * 60 * 60 * 24),
      )
      if (dayDiff > windowDays) continue
      const rightAmt = new Decimal(right.amount).abs()
      if (!leftAmt.equals(rightAmt)) continue
      pairs.push({
        aId: left.id,
        bId: right.id,
        amount: leftAmt.toFixed(4),
      })
      used.add(left.id)
      used.add(right.id)
      break
    }
  }
  return pairs
}
