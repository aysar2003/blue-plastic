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
  'project:create',
  'pos:read',
  'pos:sell',
  'report:read',
  'calendar:create',
  'calendar:update',
  'calendar:delete',
]

/** Sales lead — same desk as Sales, plus sales/payment approvals and overview. */
const SALES_MANAGER: Permission[] = [
  ...SALES,
  'invoice:approve',
  'payment:approve',
  'customer:approve',
  'customer:archive',
  'invoice:void',
  'payment:update',
  'payment:void',
  'report:overview',
]

/** AR desk — customers and receivables without POS or approvals. */
const AR_CLERK: Permission[] = [
  'org:read',
  'customer:read',
  'customer:create',
  'customer:update',
  'customer:archive',
  'item:read',
  'invoice:read',
  'invoice:create',
  'invoice:update',
  'invoice:void',
  'invoice:send',
  'payment:read',
  'payment:create',
  'payment:update',
  'payment:void',
  'project:read',
  'report:read',
  'calendar:read',
  'calendar:create',
  'calendar:update',
  'calendar:delete',
]

/** Buyers — vendors and AP, not AR or the full ledger. */
const PURCHASING: Permission[] = [
  'org:read',
  'vendor:read',
  'vendor:create',
  'vendor:update',
  'vendor:archive',
  'item:read',
  'item:create',
  'item:update',
  'bill:read',
  'bill:create',
  'bill:update',
  'bill:void',
  'bill:approve',
  'expense:read',
  'expense:create',
  'expense:update',
  'expense:void',
  'expense:approve',
  'inventory:read',
  'inventory:adjust',
  'inventory:approve',
  'project:read',
  'report:read',
  'calendar:read',
  'calendar:create',
  'calendar:update',
  'calendar:delete',
]

/** Purchasing lead — same AP desk with vendor approvals and overview. */
const PURCHASING_MANAGER: Permission[] = [
  ...PURCHASING,
  'vendor:approve',
  'report:overview',
]

/** AP desk — vendors and payables without approvals. */
const AP_CLERK: Permission[] = [
  'org:read',
  'vendor:read',
  'vendor:create',
  'vendor:update',
  'vendor:archive',
  'item:read',
  'bill:read',
  'bill:create',
  'bill:update',
  'bill:void',
  'expense:read',
  'expense:create',
  'expense:update',
  'expense:void',
  'inventory:read',
  'report:read',
  'calendar:read',
  'calendar:create',
  'calendar:update',
  'calendar:delete',
]

/** Banking desk — moves money, does not own the ledger. */
const BANK_CLERK: Permission[] = [
  'org:read',
  'bank:read',
  'bank:transact',
  'bank:import',
  'payment:read',
  'expense:read',
  'account:read',
  'report:read',
  'calendar:read',
]

/** Till staff — sell and take payment, not back-office books. */
const CASHIER: Permission[] = [
  'org:read',
  'customer:read',
  'item:read',
  'invoice:read',
  'invoice:create',
  'payment:read',
  'payment:create',
  'pos:read',
  'pos:sell',
  'report:read',
  'calendar:read',
]

/** Till lead — cashier plus POS configuration and void rights. */
const POS_SUPERVISOR: Permission[] = [
  ...CASHIER,
  'pos:manage',
  'customer:create',
  'customer:update',
  'invoice:void',
  'payment:void',
]

/** Stock lead — store work plus item master and inventory approvals. */
const WAREHOUSE_MANAGER: Permission[] = [
  'org:read',
  'item:read',
  'item:create',
  'item:update',
  'item:archive',
  'customer:read',
  'vendor:read',
  'invoice:read',
  'bill:read',
  'bill:create',
  'inventory:read',
  'inventory:adjust',
  'inventory:approve',
  'report:read',
  'calendar:read',
  'calendar:create',
  'calendar:update',
  'calendar:delete',
]

/** Customer jobs — projects with light sales access. */
const PROJECT_MANAGER: Permission[] = [
  'org:read',
  'customer:read',
  'customer:create',
  'customer:update',
  'item:read',
  'project:read',
  'project:create',
  'project:update',
  'invoice:read',
  'invoice:create',
  'invoice:update',
  'invoice:send',
  'payment:read',
  'report:read',
  'calendar:read',
  'calendar:create',
  'calendar:update',
  'calendar:delete',
]

/** Master-data clerk — cards only, no posting. */
const MASTER_DATA: Permission[] = [
  'org:read',
  'customer:read',
  'customer:create',
  'customer:update',
  'customer:archive',
  'vendor:read',
  'vendor:create',
  'vendor:update',
  'vendor:archive',
  'item:read',
  'item:create',
  'item:update',
  'item:archive',
  'report:read',
  'calendar:read',
]

/** Read-only plus the audit trail — external or internal review. */
const AUDITOR: Permission[] = [...READ_ONLY, 'audit:read', 'report:export']

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
  'project:create',
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
/** Approvers (SOX checker) — Accountant and above by default. */
const APPROVE: Permission[] = [
  'invoice:approve',
  'payment:approve',
  'bill:approve',
  'expense:approve',
  'bank:approve',
  'inventory:approve',
  'journal:approve',
  'customer:approve',
  'vendor:approve',
]

const ACCOUNTANT: Permission[] = [
  ...BOOKKEEPER,
  ...APPROVE,
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
  'project:update',
]

/**
 * Operations manager — enters work, approves, sees overview. Cannot post
 * journals, close periods, edit the chart, or manage users.
 */
const MANAGER: Permission[] = [
  ...BOOKKEEPER,
  ...APPROVE,
  'pos:manage',
  'report:overview',
  'project:update',
  'portal:manage',
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
  MANAGER: new Set(MANAGER),
  ACCOUNTANT: new Set(ACCOUNTANT),
  BOOKKEEPER: new Set(BOOKKEEPER),
  SALES_MANAGER: new Set(SALES_MANAGER),
  SALES: new Set(SALES),
  AR_CLERK: new Set(AR_CLERK),
  PURCHASING_MANAGER: new Set(PURCHASING_MANAGER),
  PURCHASING: new Set(PURCHASING),
  AP_CLERK: new Set(AP_CLERK),
  BANK_CLERK: new Set(BANK_CLERK),
  POS_SUPERVISOR: new Set(POS_SUPERVISOR),
  CASHIER: new Set(CASHIER),
  WAREHOUSE_MANAGER: new Set(WAREHOUSE_MANAGER),
  STORE_KEEPER: new Set(STORE_KEEPER),
  PROJECT_MANAGER: new Set(PROJECT_MANAGER),
  MASTER_DATA: new Set(MASTER_DATA),
  AUDITOR: new Set(AUDITOR),
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
