import 'server-only'

import { Decimal, roundToCurrency, ZERO } from '@/lib/money'
import { computeLineTax, summariseTax, type TaxCodeShape, type TaxResult } from './tax'

export type DraftSalesLine = {
  itemId?: string | null
  description?: string | null
  quantity: Decimal.Value
  unitPrice: Decimal.Value
  discountPercent?: Decimal.Value | null
  taxCodeId?: string | null
  incomeAccountId?: string | null
  serviceDate?: string | null
  /** The store this line is received into or issued from. */
  storeId?: string | null
  /**
   * Tracked stock. Its cost belongs to the inventory asset, so the journal
   * builder must not also post it to an expense account — doing both would debit
   * the same purchase twice.
   */
  isStock?: boolean
}

export type PricedLine = {
  source: DraftSalesLine
  lineNumber: number
  quantity: Decimal
  unitPrice: Decimal
  /** Tax-exclusive line total after the line discount. */
  amount: Decimal
  taxAmount: Decimal
  tax: TaxResult
  incomeAccountId: string | null
  taxCodeId: string | null
  isStock: boolean
}

export type PricedDocument = {
  lines: PricedLine[]
  subtotal: Decimal
  /** Document-level discount. Line discounts are already inside `subtotal`. */
  discountAmount: Decimal
  /** What the line discounts came to, for showing on the document. */
  lineDiscountTotal: Decimal
  taxTotal: Decimal
  total: Decimal
  /** Tax owed per rate, ready to become one journal line each. */
  taxByRate: Map<
    string,
    { name: string; amount: Decimal; salesAccountId: string | null; purchaseAccountId: string | null }
  >
}

/**
 * Price a document.
 *
 * The order of operations is the whole of it, and it is not arbitrary:
 *
 *   quantity x unit price  ->  less the line discount  ->  tax on what remains
 *
 * Tax is charged on the discounted amount because that is what the customer is
 * actually being charged. Applying the discount after tax would collect tax on
 * money nobody paid.
 *
 * Every line is rounded to the currency before it is summed — see the note in
 * `tax.ts` on why the document total is the sum of its lines rather than a
 * calculation on the whole.
 */
export type DocumentDiscount = {
  /** `percent` is a share of the subtotal. `amount` is money off, never more than the subtotal. */
  kind: 'amount' | 'percent'
  value: Decimal.Value
}

export function priceDocument(
  lines: DraftSalesLine[],
  taxCodes: Map<string, TaxCodeShape>,
  currency: string,
  documentDiscount?: DocumentDiscount | null,
): PricedDocument {
  const priced: PricedLine[] = []
  let subtotal = ZERO
  let lineDiscountTotal = ZERO

  lines.forEach((line, index) => {
    const quantity = new Decimal(line.quantity)
    const unitPrice = new Decimal(line.unitPrice)
    const gross = roundToCurrency(quantity.times(unitPrice), currency)

    const discountPercent = line.discountPercent ? new Decimal(line.discountPercent) : ZERO
    const discount = discountPercent.isZero()
      ? ZERO
      : roundToCurrency(gross.times(discountPercent).dividedBy(100), currency)

    const amount = gross.minus(discount)

    const code = line.taxCodeId ? (taxCodes.get(line.taxCodeId) ?? null) : null
    const tax = computeLineTax(amount, code, currency)

    // For an inclusive code the entered price already contained the tax, so the
    // revenue recognised is the extracted net, not the price on the line.
    const net = code?.isInclusive ? tax.net : amount

    priced.push({
      source: line,
      lineNumber: index + 1,
      quantity,
      unitPrice,
      amount: net,
      taxAmount: tax.tax,
      tax,
      incomeAccountId: line.incomeAccountId ?? null,
      taxCodeId: line.taxCodeId ?? null,
      isStock: line.isStock ?? false,
    })

    subtotal = subtotal.plus(net)
    lineDiscountTotal = lineDiscountTotal.plus(discount)
  })

  const summary = summariseTax(priced.map((line) => line.tax))
  const discountAmount = documentDiscountAmount(subtotal, documentDiscount, currency)

  // A document discount comes off before tax, in the same way a line discount
  // does. Tax already computed on the full subtotal is scaled by what remains.
  const kept = subtotal.minus(discountAmount)
  const ratio = subtotal.isZero() ? ZERO : kept.dividedBy(subtotal)
  const taxByRate = new Map<
    string,
    { name: string; amount: Decimal; salesAccountId: string | null; purchaseAccountId: string | null }
  >()
  let taxTotal = ZERO
  for (const [key, rate] of summary.byRate) {
    const amount = discountAmount.isZero() ? rate.amount : roundToCurrency(rate.amount.times(ratio), currency)
    taxByRate.set(key, { ...rate, amount })
    taxTotal = taxTotal.plus(amount)
  }

  return {
    lines: priced,
    subtotal,
    // Line discounts are already inside each line's amount. This figure is only
    // the extra discount taken off the whole document.
    discountAmount,
    lineDiscountTotal,
    taxTotal,
    total: kept.plus(taxTotal),
    taxByRate,
  }
}

function documentDiscountAmount(
  subtotal: Decimal,
  discount: DocumentDiscount | null | undefined,
  currency: string,
): Decimal {
  if (!discount || subtotal.lessThanOrEqualTo(0)) return ZERO
  const value = new Decimal(discount.value || 0)
  if (value.lessThanOrEqualTo(0)) return ZERO
  if (discount.kind === 'percent') {
    const percent = Decimal.min(value, new Decimal(100))
    return roundToCurrency(subtotal.times(percent).dividedBy(100), currency)
  }
  return roundToCurrency(Decimal.min(value, subtotal), currency)
}
