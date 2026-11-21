import type { Permission } from '@/lib/permissions-catalog'

/**
 * Management boards (snapshot, overview, analytics) need `report:overview`.
 * Role templates live in `server/auth/permissions.ts`.
 */
export const BUSINESS_OVERVIEW_PERMISSION = 'report:overview' satisfies Permission

export const BUSINESS_OVERVIEW_HREF = '/reports/business-overview'
/** Canonical home for Company Snapshot (inside Reports). */
export const COMPANY_SNAPSHOT_HREF = '/reports/snapshot'
/** Old launcher path — still redirects, still gated. */
export const COMPANY_SNAPSHOT_LEGACY_HREF = '/snapshots'
export const ANALYTICS_BOARD_HREF = '/analytics'

export function canViewBusinessOverview(
  permissions: ReadonlySet<string> | Iterable<string>,
): boolean {
  const allowed = permissions instanceof Set ? permissions : new Set(permissions)
  return allowed.has(BUSINESS_OVERVIEW_PERMISSION)
}

function pathOnly(href: string) {
  return href.split(/[?#]/)[0]
}

function isOverviewGatedHref(href: string) {
  const path = pathOnly(href)
  return (
    path === BUSINESS_OVERVIEW_HREF ||
    path === COMPANY_SNAPSHOT_HREF ||
    path === COMPANY_SNAPSHOT_LEGACY_HREF ||
    path === ANALYTICS_BOARD_HREF
  )
}

/** Drops management-board links when the caller lacks that capability. */
export function withoutBusinessOverview<T extends { href: string }>(
  items: readonly T[],
  permissions: ReadonlySet<string> | Iterable<string>,
): T[] {
  if (canViewBusinessOverview(permissions)) return [...items]
  return items.filter((item) => !isOverviewGatedHref(item.href))
}
