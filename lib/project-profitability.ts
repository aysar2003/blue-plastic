import { Decimal, ZERO } from '@/lib/money'

export type ProjectProfitSlice = {
  income: Decimal
  purchaseCost: Decimal
  stockCost: Decimal
  laborCost: Decimal
}

export function emptySlice(): ProjectProfitSlice {
  return {
    income: ZERO,
    purchaseCost: ZERO,
    stockCost: ZERO,
    laborCost: ZERO,
  }
}

export function profitOf(slice: ProjectProfitSlice): Decimal {
  return slice.income.minus(slice.purchaseCost).minus(slice.stockCost).minus(slice.laborCost)
}

/** Signed sales amount into income (credits negative). */
export function addSalesIncome(
  slice: ProjectProfitSlice,
  type: string,
  subtotal: Decimal.Value,
): ProjectProfitSlice {
  const amount = new Decimal(subtotal)
  const signed =
    type === 'CREDIT_MEMO' || type === 'REFUND_RECEIPT' ? amount.negated() : amount
  return { ...slice, income: slice.income.plus(signed) }
}

/** Signed purchase amount into purchase cost (vendor credits negative). */
export function addPurchaseCost(
  slice: ProjectProfitSlice,
  type: string,
  subtotal: Decimal.Value,
): ProjectProfitSlice {
  const amount = new Decimal(subtotal)
  const signed = type === 'VENDOR_CREDIT' ? amount.negated() : amount
  return { ...slice, purchaseCost: slice.purchaseCost.plus(signed) }
}

/** Absolute COGS value from a sale stock issue (movement value is signed). */
export function addStockCost(slice: ProjectProfitSlice, movementValue: Decimal.Value): ProjectProfitSlice {
  return { ...slice, stockCost: slice.stockCost.plus(new Decimal(movementValue).abs()) }
}

/** Labor at hours × rate (SME uses billable rate as the only rate on the card). */
export function addLaborCost(
  slice: ProjectProfitSlice,
  hours: Decimal.Value,
  rate: Decimal.Value | null | undefined,
): ProjectProfitSlice {
  const hourly = new Decimal(rate?.toString() ?? '0')
  if (hourly.isZero()) return slice
  return { ...slice, laborCost: slice.laborCost.plus(new Decimal(hours).times(hourly)) }
}

export function mergeSlices(a: ProjectProfitSlice, b: ProjectProfitSlice): ProjectProfitSlice {
  return {
    income: a.income.plus(b.income),
    purchaseCost: a.purchaseCost.plus(b.purchaseCost),
    stockCost: a.stockCost.plus(b.stockCost),
    laborCost: a.laborCost.plus(b.laborCost),
  }
}
