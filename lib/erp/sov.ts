import { Decimal, ZERO } from '@/lib/money'

import { clampPercent, retentionHeld } from '@/lib/erp/verticals-p5'

export type SovLineInput = {
  budgetAmount: string | number
  percentComplete: string | number
  billedPercent?: string | number | null
  thisBillAmount?: string | number | null
  retainagePercent?: string | number | null
}

export type SovLineComputed = {
  budget: string
  percentComplete: number
  billedPercent: number
  thisBillGross: string
  retainage: string
  thisBillNet: string
  remaining: string
}

/** This-bill gross from % complete (or an explicit this-bill amount) minus retainage. */
export function computeSovLine(input: SovLineInput): SovLineComputed {
  const budget = new Decimal(input.budgetAmount || 0)
  const percentComplete = clampPercent(input.percentComplete)
  const billedPercent = clampPercent(input.billedPercent)
  const retainagePct = clampPercent(input.retainagePercent)
  let thisBill = ZERO
  if (input.thisBillAmount != null && input.thisBillAmount !== '') {
    thisBill = Decimal.max(new Decimal(input.thisBillAmount), ZERO)
  } else if (percentComplete > billedPercent) {
    thisBill = budget.times(percentComplete - billedPercent).div(100)
  }
  const held = new Decimal(retentionHeld(thisBill.toFixed(4), retainagePct))
  const billedToDate = budget.times(billedPercent).div(100)
  return {
    budget: budget.toFixed(4),
    percentComplete,
    billedPercent,
    thisBillGross: thisBill.toFixed(4),
    retainage: held.toFixed(4),
    thisBillNet: thisBill.minus(held).toFixed(4),
    remaining: Decimal.max(budget.minus(billedToDate).minus(thisBill), ZERO).toFixed(4),
  }
}

export function siteStoreIssueValue(movements: { quantity: string | number; value: string | number }[]): string {
  let issued = ZERO
  for (const row of movements) {
    const qty = new Decimal(row.quantity)
    if (qty.greaterThanOrEqualTo(0)) continue
    issued = issued.plus(new Decimal(row.value).abs())
  }
  return issued.toFixed(4)
}
