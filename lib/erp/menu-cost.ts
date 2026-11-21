import { Decimal, ZERO } from '@/lib/money'

export type MenuCostLine = {
  componentItemId: string
  quantity: string
  averageCost: string
}

/** Sum component qty × avg cost for a GROUP / menu item. */
export function groupFoodCost(components: MenuCostLine[]): string {
  const total = components.reduce((sum, row) => {
    const qty = new Decimal(row.quantity || '0')
    const cost = new Decimal(row.averageCost || '0')
    return sum.plus(qty.times(cost))
  }, ZERO)
  return total.toFixed(4)
}

/** Margin % from sales price and food cost. */
export function menuMarginPercent(salesPrice: string | null, foodCost: string): string | null {
  if (!salesPrice) return null
  const price = new Decimal(salesPrice)
  if (price.lessThanOrEqualTo(0)) return null
  const cost = new Decimal(foodCost)
  const margin = price.minus(cost).dividedBy(price).times(100)
  return margin.toDecimalPlaces(2).toFixed(2)
}

/** Period food-cost % = component issue value ÷ GROUP/POS sales × 100. */
export function periodFoodCostPercent(
  componentIssueValue: string | number,
  groupOrPosSales: string | number,
): string | null {
  const sales = new Decimal(groupOrPosSales || 0)
  if (sales.lessThanOrEqualTo(0)) return null
  const issues = new Decimal(componentIssueValue || 0)
  return issues.dividedBy(sales).times(100).toDecimalPlaces(2).toFixed(2)
}

/** Actual issues minus recipe expected (positive = over-usage). */
export function recipeVsActualVariance(recipeExpected: string | number, actualIssued: string | number): string {
  return new Decimal(actualIssued || 0).minus(recipeExpected || 0).toDecimalPlaces(4).toFixed(4)
}

const DEFAULT_LOW_MARGIN_PERCENT = 25

/** True when margin % is known and below the hospitality threshold. */
export function isMenuMarginLow(
  marginPercent: string | null | undefined,
  thresholdPercent = DEFAULT_LOW_MARGIN_PERCENT,
): boolean {
  if (marginPercent == null) return false
  const n = Number(marginPercent)
  return Number.isFinite(n) && n < thresholdPercent
}