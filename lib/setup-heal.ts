/** Clerk-set reorder points (including zero) are never replaced by heal. */
export function shouldHealReorderPoint(
  current: { toString(): string } | string | number | null | undefined,
): boolean {
  if (current == null) return true
  if (typeof current === 'string' && current.trim() === '') return true
  return false
}

export type SetupHealthGapRow = {
  kind: string
  name: string
  sku?: string | null
  id?: string | null
  detail: string
}

export const SETUP_HEALTH_GAP_HEADERS = ['Kind', 'Name', 'SKU', 'Id', 'Detail'] as const
