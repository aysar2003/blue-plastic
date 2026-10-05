import type { Role } from '@prisma/client'

import { PERMISSIONS, type Permission, isPermission } from '@/lib/permissions-catalog'

export { PERMISSIONS, type Permission, isPermission }
export { PERMISSION_GROUPS } from '@/lib/permissions-catalog'

/**
 * Authorisation is permission-based at the call site and role-based only here.
 * Code asks for `journal:post`, never `role === 'ADMIN'` — so adding a role, or
 * moving a capability between roles, is a change to this file alone.
 *
 * Members may also carry an explicit permission list (`permissionsOverride`).
 * When that list is non-empty it replaces the role template — the international
 * ERP pattern of “start from a role, or assign capabilities by hand”.
 */

const ALL = PERMISSIONS

const READ_ONLY = ALL.filter((p) => p.endsWith(':read')) as Permission[]

/**
 * SALES can raise invoices and take payments but cannot touch the chart of
 * accounts, post journals, reconcile a bank account or close a period. That
 * separation is the whole point of having roles in an accounting system.
 */
const SALES: Permission[] = [
  ...READ_ONLY.filter((p) => !p.startsWith('audit') && !p.startsWith('journal') && !p.startsWith('bank')),
  'customer:create',
  'customer:update',
  'item:read',
  'invoice:create',
  'invoice:update',
  'invoice:send',
  'payment:create',
  'pos:read',
  'pos:sell',
  'report:read',
]

/** BOOKKEEPER enters day-to-day transactions but cannot close periods or manage users. */
const BOOKKEEPER: Permission[] = [
  ...READ_ONLY,
  'customer:create',
  'customer:update',
  'customer:archive',
  'vendor:create',
  'vendor:update',
  'vendor:archive',
  'item:create',
  'item:update',
  'item:archive',
  'invoice:create',
  'invoice:update',
  'invoice:void',
  'invoice:send',
  'payment:create',
  'payment:update',
  'payment:void',
  'bill:create',
  'bill:update',
  'bill:void',
  'expense:create',
  'expense:update',
  'expense:void',
  'bank:transact',
  'bank:import',
  'journal:create',
  'inventory:adjust',
  'pos:read',
  'pos:sell',
  'report:read',
  'report:export',
]

/** ACCOUNTANT adds the ledger-level authority: posting, reversing, closing. */
const ACCOUNTANT: Permission[] = [
  ...BOOKKEEPER,
  'account:create',
  'account:update',
  'account:archive',
  'journal:post',
  'journal:reverse',
  'period:close',
  'period:reopen',
  'tax:manage',
  'bank:reconcile',
  'pos:manage',
  'audit:read',
]

const ADMIN: Permission[] = [
  ...ACCOUNTANT,
  'org:update',
  'user:invite',
  'user:update',
  'user:remove',
]

/** Store keeper: shelf, tickets, transfers, receive — not the books. */
const STORE_KEEPER: Permission[] = [
  'org:read',
  'item:read',
  'customer:read',
  'vendor:read',
  'invoice:read',
  'bill:read',
  'bill:create',
  'inventory:read',
  'inventory:adjust',
  'report:read',
]

/**
 * CUSTOM has no built-in matrix — effective access comes only from
 * `permissionsOverride` on the membership row.
 */
export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  OWNER: new Set(ALL),
  ADMIN: new Set(ADMIN),
  ACCOUNTANT: new Set(ACCOUNTANT),
  BOOKKEEPER: new Set(BOOKKEEPER),
  SALES: new Set(SALES),
  STORE_KEEPER: new Set(STORE_KEEPER),
  VIEWER: new Set(READ_ONLY),
  CUSTOM: new Set(),
}

export function permissionsFor(role: Role): ReadonlySet<Permission> {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.VIEWER
}

/**
 * Resolve what a member may do: an explicit override list wins; otherwise the
 * role template. Invalid keys are dropped so a bad row cannot mint unknown capabilities.
 */
export function effectivePermissions(
  role: Role,
  permissionsOverride: readonly string[] | null | undefined,
): ReadonlySet<Permission> {
  if (permissionsOverride && permissionsOverride.length > 0) {
    const allowed = permissionsOverride.filter(isPermission)
    if (allowed.length > 0) return new Set(allowed)
  }
  if (role === 'CUSTOM') return new Set()
  return permissionsFor(role)
}

export function can(role: Role, permission: Permission): boolean {
  return permissionsFor(role).has(permission)
}

/** Sanitize a client-supplied list into a unique, ordered Permission[]. */
export function sanitizePermissions(input: readonly string[] | null | undefined): Permission[] {
  if (!input?.length) return []
  const seen = new Set<Permission>()
  for (const key of input) {
    if (isPermission(key)) seen.add(key)
  }
  return PERMISSIONS.filter((p) => seen.has(p))
}
