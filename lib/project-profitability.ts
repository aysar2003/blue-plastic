import { Decimal, ZERO } from '@/lib/money'

export type ProjectProfitSlice = {
  income: Decimal
  purchaseCost: Decimal
  stockCost: Decimal
  /** Internal labour cost (hours × costRate). */
  laborCost: Decimal
  /** Charge-out labour (hours × billableRate). */
  laborCharge: Decimal
}

export function emptySlice(): ProjectProfitSlice {
  return {
    income: ZERO,
    purchaseCost: ZERO,
    stockCost: ZERO,
    laborCost: ZERO,
    laborCharge: ZERO,
  }
}

export function profitOf(slice: ProjectProfitSlice): Decimal {
  return slice.income.minus(slice.purchaseCost).minus(slice.stockCost).minus(slice.laborCost)
}

/**
 * Document subtotal in org base. `exchangeRate` is base per 1 document unit
 * (1 when the document is already in base). Missing or non-positive rates stay 1.
 */
export function toBaseAmount(
  amount: Decimal.Value,
  exchangeRate?: Decimal.Value | null,
): Decimal {
  const rate = new Decimal(exchangeRate?.toString() ?? '1')
  const safeRate = rate.lessThanOrEqualTo(0) ? new Decimal(1) : rate
  return new Decimal(amount).times(safeRate)
}

/** Signed sales amount into income (credits negative). Amounts convert to org base. */
export function addSalesIncome(
  slice: ProjectProfitSlice,
  type: string,
  subtotal: Decimal.Value,
  exchangeRate?: Decimal.Value | null,
): ProjectProfitSlice {
  const amount = toBaseAmount(subtotal, exchangeRate)
  const signed =
    type === 'CREDIT_MEMO' || type === 'REFUND_RECEIPT' ? amount.negated() : amount
  return { ...slice, income: slice.income.plus(signed) }
}

/** Signed purchase amount into purchase cost (vendor credits negative). Amounts convert to org base. */
export function addPurchaseCost(
  slice: ProjectProfitSlice,
  type: string,
  subtotal: Decimal.Value,
  exchangeRate?: Decimal.Value | null,
): ProjectProfitSlice {
  const amount = toBaseAmount(subtotal, exchangeRate)
  const signed = type === 'VENDOR_CREDIT' ? amount.negated() : amount
  return { ...slice, purchaseCost: slice.purchaseCost.plus(signed) }
}

/** Absolute COGS value from a sale stock issue (movement value is signed). */
export function addStockCost(slice: ProjectProfitSlice, movementValue: Decimal.Value): ProjectProfitSlice {
  return { ...slice, stockCost: slice.stockCost.plus(new Decimal(movementValue).abs()) }
}

/**
 * Internal labour cost at hours × costRate.
 * When costRate is missing, falls back to billableRate so older entries still hit Job P&L.
 */
export function addLaborCost(
  slice: ProjectProfitSlice,
  hours: Decimal.Value,
  rate: Decimal.Value | null | undefined,
): ProjectProfitSlice {
  const hourly = new Decimal(rate?.toString() ?? '0')
  if (hourly.isZero()) return slice
  return { ...slice, laborCost: slice.laborCost.plus(new Decimal(hours).times(hourly)) }
}

/** Charge-out labour at hours × billableRate (shown beside cost; not subtracted from profit). */
export function addLaborCharge(
  slice: ProjectProfitSlice,
  hours: Decimal.Value,
  billableRate: Decimal.Value | null | undefined,
): ProjectProfitSlice {
  const hourly = new Decimal(billableRate?.toString() ?? '0')
  if (hourly.isZero()) return slice
  return { ...slice, laborCharge: slice.laborCharge.plus(new Decimal(hours).times(hourly)) }
}

export function mergeSlices(a: ProjectProfitSlice, b: ProjectProfitSlice): ProjectProfitSlice {
  return {
    income: a.income.plus(b.income),
    purchaseCost: a.purchaseCost.plus(b.purchaseCost),
    stockCost: a.stockCost.plus(b.stockCost),
    laborCost: a.laborCost.plus(b.laborCost),
    laborCharge: a.laborCharge.plus(b.laborCharge),
  }
}
