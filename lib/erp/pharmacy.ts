/**
 * Pharmacy dispense rules — pure helpers (no I/O).
 */

import { CONTROLLED_MOVEMENT_HEADERS } from '@/lib/erp/export-headers'
import { Decimal } from '@/lib/money'

export type PharmacyItemFlags = {
  name: string
  trackLots: boolean
  pharmacyControlled: boolean
}

/** Calendar date YYYY-MM-DD comparison (expiry is inclusive end-of-day = still valid that day). */
export function isLotExpired(
  expiryDate: string | Date | null | undefined,
  asOf: string | Date,
): boolean {
  if (!expiryDate) return false
  const exp =
    typeof expiryDate === 'string'
      ? expiryDate.slice(0, 10)
      : expiryDate.toISOString().slice(0, 10)
  const day = typeof asOf === 'string' ? asOf.slice(0, 10) : asOf.toISOString().slice(0, 10)
  return exp < day
}

/**
 * Controlled / pharmacy items always need a lot on issue.
 * Expired registered lots are refused.
 */
export function assertPharmacyIssue(input: {
  item: PharmacyItemFlags
  lotNumber: string | null | undefined
  lotExpiry: string | Date | null | undefined
  asOf: string | Date
}): string | null {
  const lot = input.lotNumber?.trim() || null
  const needsLot = input.item.pharmacyControlled || input.item.trackLots

  if (input.item.pharmacyControlled && !lot) {
    return `"${input.item.name}" is pharmacy-controlled and requires a lot number to dispense.`
  }

  if (needsLot && lot && isLotExpired(input.lotExpiry, input.asOf)) {
    const exp =
      typeof input.lotExpiry === 'string'
        ? input.lotExpiry.slice(0, 10)
        : input.lotExpiry instanceof Date
          ? input.lotExpiry.toISOString().slice(0, 10)
          : ''
    return `"${input.item.name}" lot "${lot}" expired on ${exp}.`
  }

  return null
}

/** Days until expiry (negative = already expired). Null when no expiry. */
export function daysUntilExpiry(
  expiryDate: string | Date | null | undefined,
  asOf: string | Date,
): number | null {
  if (!expiryDate) return null
  const exp =
    typeof expiryDate === 'string'
      ? expiryDate.slice(0, 10)
      : expiryDate.toISOString().slice(0, 10)
  const day = typeof asOf === 'string' ? asOf.slice(0, 10) : asOf.toISOString().slice(0, 10)
  const expMs = Date.parse(`${exp}T00:00:00.000Z`)
  const dayMs = Date.parse(`${day}T00:00:00.000Z`)
  if (Number.isNaN(expMs) || Number.isNaN(dayMs)) return null
  return Math.round((expMs - dayMs) / 86_400_000)
}

export type ControlledMovementExportRow = {
  id: string
  date: string
  type: string
  quantity: string
  lotNumber: string | null
  itemId: string
  itemName: string
  sku: string | null
  journalId: string | null
  journalNumber: string | null
}

export function controlledMovementsToCsv(rows: ControlledMovementExportRow[]): string {
  const header = [...CONTROLLED_MOVEMENT_HEADERS]
  const escape = (value: string | null) => {
    const raw = value ?? ''
    if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
    return raw
  }
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(
      [
        row.date,
        row.itemName,
        row.sku,
        row.lotNumber,
        row.type,
        row.quantity,
        row.journalNumber,
      ]
        .map((cell) => escape(cell))
        .join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

export type FefoLotCandidate = {
  lotId: string
  lotNumber: string
  expiryDate: string | null
  quantity: string
}

/** Pick the first non-expired lot with stock, earliest expiry first (FEFO). */
export function pickFefoLot<T extends FefoLotCandidate>(lots: T[], asOf: string | Date): T | null {
  const eligible = lots.filter((lot) => {
    const qty = new Decimal(lot.quantity)
    return qty.greaterThan(0) && !isLotExpired(lot.expiryDate, asOf)
  })
  eligible.sort((a, b) => {
    if (!a.expiryDate && !b.expiryDate) return a.lotNumber.localeCompare(b.lotNumber)
    if (!a.expiryDate) return 1
    if (!b.expiryDate) return -1
    const byExpiry = a.expiryDate.localeCompare(b.expiryDate)
    return byExpiry !== 0 ? byExpiry : a.lotNumber.localeCompare(b.lotNumber)
  })
  return eligible[0] ?? null
}
