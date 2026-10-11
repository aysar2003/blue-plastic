/**
 * Main company + sub-companies (one level).
 *
 * A main company has `parentOrgId = null` and up to MAX_SUB_COMPANIES children.
 * Books stay separate; group admins roll up reports across the tree.
 */

export const MAX_SUB_COMPANIES = 2

export type CompanyGroupKind = 'main' | 'sub' | 'standalone'

/** Label for the No Company Open list and reports. */
export function companyGroupKind(input: {
  parentOrgId: string | null
  childCount: number
}): CompanyGroupKind {
  if (input.parentOrgId) return 'sub'
  if (input.childCount > 0) return 'main'
  return 'standalone'
}

export function companyGroupLabel(kind: CompanyGroupKind): string {
  if (kind === 'main') return 'Main'
  if (kind === 'sub') return 'Sub'
  return 'Solo'
}
