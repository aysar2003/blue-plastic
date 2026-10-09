import type { Permission } from '@/lib/permissions-catalog'

/**
 * The business overview is a management snapshot — bank balances, profit,
 * expenses, and invoice totals — not a general report. Call sites ask for
 * this permission; role templates live in `server/auth/permissions.ts`.
 */
export const BUSINESS_OVERVIEW_PERMISSION = 'report:overview' satisfies Permission

export const BUSINESS_OVERVIEW_HREF = '/reports/business-overview'

export function canViewBusinessOverview(
  permissions: ReadonlySet<string> | Iterable<string>,
): boolean {
  const allowed = permissions instanceof Set ? permissions : new Set(permissions)
  return allowed.has(BUSINESS_OVERVIEW_PERMISSION)
}

function isBusinessOverviewHref(href: string) {
  const path = href.split(/[?#]/)[0]
  return path === BUSINESS_OVERVIEW_HREF
}

/** Drops links to the business overview when the caller lacks that capability. */
export function withoutBusinessOverview<T extends { href: string }>(
  items: readonly T[],
  permissions: ReadonlySet<string> | Iterable<string>,
): T[] {
  if (canViewBusinessOverview(permissions)) return [...items]
  return items.filter((item) => !isBusinessOverviewHref(item.href))
}
