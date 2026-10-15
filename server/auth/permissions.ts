import type { Role } from '@prisma/client'

import {
  PERMISSIONS,
  STAFF_PERMISSIONS,
  type Permission,
  isPermission,
  isStaffPermission,
} from '@/lib/permissions-catalog'

export { PERMISSIONS, STAFF_PERMISSIONS, type Permission, isPermission, isStaffPermission }
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
 * accounts, post journals, reconcile a bank account, close a period, or open
 * the business overview. That separation is the whole point of having roles
 * in an accounting system.
 */
const SALES: Permission[] = [
  ...READ_ONLY.filter((p) => !p.startsWith('audit') && !p.startsWith('journal') && !p.startsWith('bank')),
  'customer:create',
  'customer:update',
  'portal:manage',
  'item:read',
  'invoice:create',
  'invoice:update',
  'invoice:send',
  'payment:create',
  'pos:read',
  'pos:sell',
  'report:read',
  'calendar:create',
  'calendar:update',
  'calendar:delete',
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
  'calendar:create',
  'calendar:update',
  'calendar:delete',
]

/**
 * ACCOUNTANT adds the ledger-level authority: posting, reversing, closing,
 * and the business overview (cash, bank balances, profit, expenses).
 * Reopening a locked/closed period is Owner/Admin only — once closed, the books
 * stay closed until someone with that authority unlocks them.
 * A bookkeeper does not get that snapshot with the role; an owner can grant
 * `report:overview` from the matrix.
 */
const ACCOUNTANT: Permission[] = [
  ...BOOKKEEPER,
  'account:create',
  'account:update',
  'account:archive',
  'journal:post',
  'journal:reverse',
  'period:close',
  'tax:manage',
  'bank:reconcile',
  'pos:manage',
  'audit:read',
  'report:overview',
]

const ADMIN: Permission[] = [
  ...ACCOUNTANT,
  'period:reopen',
  'org:update',
  'user:invite',
  'user:update',
  'user:remove',
  'portal:manage',
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
  'calendar:read',
  'calendar:create',
  'calendar:update',
  'calendar:delete',
]

/** Portal login — balance, invoices, payments, and statement only. */
const CUSTOMER: Permission[] = ['portal:read']

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
  CUSTOMER: new Set(CUSTOMER),
}

export function permissionsFor(role: Role): ReadonlySet<Permission> {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.VIEWER
}

/**
 * Resolve what a member may do: an explicit override list wins; otherwise the
 * role template. Invalid keys are dropped so a bad row cannot mint unknown capabilities.
 * CUSTOMER always uses the portal template — overrides cannot escalate into the ERP.
 */
export function effectivePermissions(
  role: Role,
  permissionsOverride: readonly string[] | null | undefined,
): ReadonlySet<Permission> {
  if (role === 'CUSTOMER') return permissionsFor('CUSTOMER')
  if (permissionsOverride && permissionsOverride.length > 0) {
    const allowed = permissionsOverride.filter(isStaffPermission)
    if (allowed.length > 0) return new Set(allowed)
  }
  if (role === 'CUSTOM') return new Set()
  return permissionsFor(role)
}

export function can(role: Role, permission: Permission): boolean {
  return permissionsFor(role).has(permission)
}

/** Sanitize a client-supplied list into a unique, ordered staff Permission[]. */
export function sanitizePermissions(input: readonly string[] | null | undefined): Permission[] {
  if (!input?.length) return []
  const seen = new Set<Permission>()
  for (const key of input) {
    if (isStaffPermission(key)) seen.add(key)
  }
  return STAFF_PERMISSIONS.filter((p) => seen.has(p))
}
