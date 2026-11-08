/**
 * School / university fee helpers — pure (no I/O).
 */

export const ENROLLMENT_STATUSES = ['ENROLLED', 'WITHDRAWN', 'COMPLETED'] as const
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number]

/** Clamp scholarship percent to 0–100. */
export function normalizeScholarshipPercent(value: string | number | null | undefined): number {
  const n = typeof value === 'string' ? Number(value) : Number(value ?? 0)
  if (!Number.isFinite(n) || n <= 0) return 0
  if (n >= 100) return 100
  return Math.round(n * 10000) / 10000
}

/** Document-level discount amount from fee subtotal × scholarship %. */
export function scholarshipDiscountAmount(
  subtotal: string | number,
  scholarshipPercent: string | number,
): string {
  const base = Number(subtotal)
  const pct = normalizeScholarshipPercent(scholarshipPercent)
  if (!Number.isFinite(base) || base <= 0 || pct <= 0) return '0.0000'
  return ((base * pct) / 100).toFixed(4)
}

export function canBillEnrollment(input: {
  status: EnrollmentStatus
  salesDocumentId?: string | null
}): boolean {
  if (input.salesDocumentId) return false
  return input.status === 'ENROLLED'
}

export function canWithdrawEnrollment(status: EnrollmentStatus): boolean {
  return status === 'ENROLLED'
}

/** Active enrollment count for a term (excludes withdrawn). */
export function enrollmentCount(
  rows: { status: EnrollmentStatus }[],
): { active: number; withdrawn: number; completed: number; total: number } {
  let active = 0
  let withdrawn = 0
  let completed = 0
  for (const row of rows) {
    if (row.status === 'ENROLLED') active += 1
    else if (row.status === 'WITHDRAWN') withdrawn += 1
    else if (row.status === 'COMPLETED') completed += 1
  }
  return { active, withdrawn, completed, total: rows.length }
}

/** Term date window sanity (startsOn ≤ endsOn). */
export function assertTermDates(startsOn: string, endsOn: string): string | null {
  const start = startsOn.slice(0, 10)
  const end = endsOn.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return 'Term dates must be YYYY-MM-DD.'
  }
  if (end < start) return 'Term end date must be on or after the start date.'
  return null
}
