/**
 * Pharmacy dispense rules — pure helpers (no I/O).
 */

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
