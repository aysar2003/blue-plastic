import { Decimal } from '@/lib/money'

export type LotSerialItemFlags = {
  name: string
  trackLots: boolean
  trackSerials: boolean
}

export function normalizeLotSerial(
  lotNumber: string | null | undefined,
  serialNumber: string | null | undefined,
): { lot: string | null; serial: string | null } {
  return {
    lot: lotNumber?.trim() || null,
    serial: serialNumber?.trim() || null,
  }
}

/**
 * Validate lot/serial rules for one inventory movement (signed quantity).
 * Receipts are positive; issues are negative.
 */
export function assertLotSerialForMovement(
  item: LotSerialItemFlags,
  quantity: Decimal,
  lotNumber: string | null | undefined,
  serialNumber: string | null | undefined,
): string | null {
  const { lot, serial } = normalizeLotSerial(lotNumber, serialNumber)
  const isReceipt = quantity.greaterThan(0)

  if (!item.trackLots && !item.trackSerials) {
    if (lot || serial) {
      return `"${item.name}" is not set to track lots or serials.`
    }
    return null
  }

  if (item.trackLots && !lot) {
    return `"${item.name}" requires a lot number on ${isReceipt ? 'receive' : 'issue'}.`
  }

  if (item.trackSerials) {
    if (!serial) {
      return `"${item.name}" requires a serial number on ${isReceipt ? 'receive' : 'issue'}.`
    }
    if (quantity.abs().greaterThan(1)) {
      return `"${item.name}" is serial-tracked: each movement must be quantity 1.`
    }
  }

  return null
}

/** Aggregate signed movements into on-hand by lot (empty string key = unlotted). */
export function onHandByLot(
  movements: { lotNumber: string | null; quantity: Decimal.Value }[],
): Map<string, Decimal> {
  const map = new Map<string, Decimal>()
  for (const row of movements) {
    const key = row.lotNumber?.trim() || ''
    const qty = new Decimal(row.quantity)
    map.set(key, (map.get(key) ?? new Decimal(0)).plus(qty))
  }
  for (const [key, qty] of map) {
    if (qty.isZero()) map.delete(key)
  }
  return map
}

/** Net quantity for one serial (receipts minus issues). */
export function onHandForSerial(
  movements: { serialNumber: string | null; quantity: Decimal.Value }[],
  serialNumber: string,
): Decimal {
  const target = serialNumber.trim()
  let total = new Decimal(0)
  for (const row of movements) {
    if ((row.serialNumber?.trim() || '') !== target) continue
    total = total.plus(row.quantity)
  }
  return total
}
