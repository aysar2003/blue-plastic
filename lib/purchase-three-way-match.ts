import { Decimal } from '@/lib/money'

/** Price difference allowed before a bill is held (one cent in base money). */
export const MATCH_PRICE_TOLERANCE = new Decimal('0.01')
/** Qty difference allowed (rounding). */
export const MATCH_QTY_TOLERANCE = new Decimal('0.0001')

export type MatchPoLine = {
  itemId: string | null
  description: string | null
  quantity: Decimal
  quantityReceived: Decimal
  unitPrice: Decimal
}

export type MatchBillLine = {
  itemId: string | null
  description: string | null
  quantity: Decimal
  unitPrice: Decimal
}

export type MatchSiblingBillLine = {
  itemId: string | null
  description: string | null
  quantity: Decimal
}

export type ThreeWayMatchResult =
  | { ok: true }
  | { ok: false; reasons: string[] }

function lineKey(itemId: string | null, description: string | null): string {
  if (itemId) return `item:${itemId}`
  return `desc:${(description ?? '').trim().toLowerCase()}`
}

/**
 * Hard 3-way match for a bill raised against a purchase order.
 *
 * Compares this bill (plus other non-void bills on the same PO) to ordered qty,
 * received qty, and PO unit prices. Standalone bills (no PO) are not checked here.
 */
export function evaluateThreeWayMatch(input: {
  poLines: MatchPoLine[]
  billLines: MatchBillLine[]
  /** Other bills already against this PO (exclude the bill under review). */
  siblingBillLines: MatchSiblingBillLine[]
}): ThreeWayMatchResult {
  const reasons: string[] = []

  const poByKey = new Map<string, MatchPoLine>()
  for (const line of input.poLines) {
    const key = lineKey(line.itemId, line.description)
    const existing = poByKey.get(key)
    if (existing) {
      poByKey.set(key, {
        ...existing,
        quantity: existing.quantity.plus(line.quantity),
        quantityReceived: existing.quantityReceived.plus(line.quantityReceived),
      })
    } else {
      poByKey.set(key, { ...line })
    }
  }

  const billedByKey = new Map<string, Decimal>()
  for (const line of [...input.siblingBillLines, ...input.billLines]) {
    const key = lineKey(line.itemId, line.description)
    billedByKey.set(key, (billedByKey.get(key) ?? new Decimal(0)).plus(line.quantity))
  }

  for (const line of input.billLines) {
    const key = lineKey(line.itemId, line.description)
    const po = poByKey.get(key)
    const label = line.itemId
      ? `item ${line.itemId}`
      : (line.description?.trim() || 'a line')

    if (!po) {
      reasons.push(`Bill has ${label} that is not on the purchase order.`)
      continue
    }

    const priceDelta = line.unitPrice.minus(po.unitPrice).abs()
    if (priceDelta.greaterThan(MATCH_PRICE_TOLERANCE)) {
      reasons.push(
        `Price for ${label} is ${line.unitPrice.toFixed(4)} but the order is ${po.unitPrice.toFixed(4)}.`,
      )
    }
  }

  for (const [key, billed] of billedByKey) {
    const po = poByKey.get(key)
    if (!po) continue
    const label = po.itemId ? `item ${po.itemId}` : (po.description?.trim() || 'a line')

    if (billed.minus(po.quantity).greaterThan(MATCH_QTY_TOLERANCE)) {
      reasons.push(
        `Billed quantity for ${label} (${billed.toFixed(4)}) exceeds ordered (${po.quantity.toFixed(4)}).`,
      )
    }
    if (billed.minus(po.quantityReceived).greaterThan(MATCH_QTY_TOLERANCE)) {
      reasons.push(
        `Billed quantity for ${label} (${billed.toFixed(4)}) exceeds received (${po.quantityReceived.toFixed(4)}).`,
      )
    }
  }

  if (reasons.length === 0) return { ok: true }
  return { ok: false, reasons }
}
