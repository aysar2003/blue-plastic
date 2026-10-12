/**
 * Per-company access limits: restriction lock, rent expiry, and max users.
 * System owner always bypasses open locks so they can extend rent or delete.
 */

export type CompanyLimitFields = {
  accessRestricted: boolean
  rentExpiresAt: Date | string | null
  maxUsers: number | null
  rentNote?: string | null
}

export type CompanyLimitStatus = {
  accessRestricted: boolean
  rentExpiresAt: string | null
  maxUsers: number | null
  rentNote: string | null
  rentExpired: boolean
  /** Staff cannot open when restricted or rent expired. */
  openBlocked: boolean
  blockReason: string | null
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function companyLimitStatus(
  org: CompanyLimitFields,
  now: Date = new Date(),
): CompanyLimitStatus {
  const expires = asDate(org.rentExpiresAt)
  const rentExpired = expires != null && expires.getTime() < now.getTime()
  const accessRestricted = Boolean(org.accessRestricted)
  const maxUsers =
    typeof org.maxUsers === 'number' && org.maxUsers > 0 ? Math.floor(org.maxUsers) : null
  const rentNote = org.rentNote?.trim() ? org.rentNote.trim() : null

  let blockReason: string | null = null
  if (accessRestricted) {
    blockReason = 'This company is locked. Ask the system owner to remove the restriction.'
  } else if (rentExpired) {
    blockReason = expires
      ? `Rent ended on ${expires.toLocaleDateString()}. Ask the system owner to extend it.`
      : 'Rent for this company has ended.'
  }

  return {
    accessRestricted,
    rentExpiresAt: expires ? expires.toISOString() : null,
    maxUsers,
    rentNote,
    rentExpired,
    openBlocked: accessRestricted || rentExpired,
    blockReason,
  }
}

/** True when inviting would exceed the seat cap. */
export function wouldExceedMaxUsers(maxUsers: number | null | undefined, activeCount: number) {
  if (maxUsers == null || maxUsers <= 0) return false
  return activeCount >= maxUsers
}
