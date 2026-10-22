import type { Role } from '@prisma/client'

/**
 * How roles are *presented*. Isomorphic by design: forms, tables and menus need
 * these on the client, while the permission matrix they describe stays on the
 * server in `server/auth/permissions.ts`. Keeping labels out of the server layer
 * is what lets the layering rule be absolute rather than have an exception.
 */
export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  ACCOUNTANT: 'Accountant',
  BOOKKEEPER: 'Bookkeeper',
  SALES_MANAGER: 'Sales manager',
  SALES: 'Sales',
  AR_CLERK: 'AR clerk',
  PURCHASING_MANAGER: 'Purchasing manager',
  PURCHASING: 'Purchasing',
  AP_CLERK: 'AP clerk',
  BANK_CLERK: 'Bank clerk',
  POS_SUPERVISOR: 'POS supervisor',
  CASHIER: 'Cashier',
  WAREHOUSE_MANAGER: 'Warehouse manager',
  STORE_KEEPER: 'Store keeper',
  PROJECT_MANAGER: 'Project manager',
  MASTER_DATA: 'Master data',
  AUDITOR: 'Auditor',
  VIEWER: 'Viewer',
  CUSTOM: 'Custom access',
  CUSTOMER: 'Customer portal',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: 'Full access, including transferring ownership. Cannot be removed. Posts without approval.',
  ADMIN: 'Everything except ownership transfer. Manages users and settings. Posts without approval.',
  MANAGER: 'Runs day-to-day operations and approvals. Cannot close periods, post journals, or manage users.',
  ACCOUNTANT: 'Full accounting authority: chart of accounts, journals, reconciliation, period close.',
  BOOKKEEPER: 'Enters day-to-day transactions. Cannot post manual journals or close periods.',
  SALES_MANAGER: 'Sales team lead: customers, invoices, payments, and sales approvals.',
  SALES: 'Customers, invoices and customer payments only.',
  AR_CLERK: 'Accounts receivable: customers, invoices and receipts — no POS and no approvals.',
  PURCHASING_MANAGER: 'Purchasing lead: vendors, bills, expenses and AP approvals.',
  PURCHASING: 'Vendors, purchase orders, bills and receiving — not the sales ledger.',
  AP_CLERK: 'Accounts payable: vendors, bills and expenses — no approvals.',
  BANK_CLERK: 'Bank transfers, deposits and statement imports — not the full ledger.',
  POS_SUPERVISOR: 'Till lead: sell, take payment, and configure POS counters.',
  CASHIER: 'POS till, customer payments and receipts — not back-office accounting.',
  WAREHOUSE_MANAGER: 'Stock lead: items, adjustments, transfers and inventory approvals.',
  STORE_KEEPER: 'Stock, store tickets, transfers and receiving — not the full ledger.',
  PROJECT_MANAGER: 'Customer projects/jobs, related sales documents and calendar.',
  MASTER_DATA: 'Create and edit customers, vendors and items only — no posting.',
  AUDITOR: 'Read-only records, reports and the audit trail. Cannot create or change transactions.',
  VIEWER: 'Read-only access to records and reports.',
  CUSTOM: 'Access chosen module by module — not a preset role.',
  CUSTOMER: 'Sees only their own invoices, payments, and statement in the customer portal.',
}

/**
 * Preset roles shown when assigning “ready-made” access.
 * Ownership moves by transfer; CUSTOM is chosen via the manual matrix, not this list.
 */
export const ASSIGNABLE_ROLES: Role[] = [
  'ADMIN',
  'MANAGER',
  'ACCOUNTANT',
  'BOOKKEEPER',
  'SALES_MANAGER',
  'SALES',
  'AR_CLERK',
  'PURCHASING_MANAGER',
  'PURCHASING',
  'AP_CLERK',
  'BANK_CLERK',
  'POS_SUPERVISOR',
  'CASHIER',
  'WAREHOUSE_MANAGER',
  'STORE_KEEPER',
  'PROJECT_MANAGER',
  'MASTER_DATA',
  'AUDITOR',
  'VIEWER',
]

/**
 * Company roles that post documents immediately when approvals are on
 * (no PENDING_APPROVAL inbox). Also may self-approve when they are a checker.
 */
export const APPROVAL_BYPASS_ROLES: ReadonlySet<Role> = new Set(['OWNER', 'ADMIN'])

export function mayBypassApprovals(role: Role): boolean {
  return APPROVAL_BYPASS_ROLES.has(role)
}

/** MembershipStatus labels — INVITED is shown as pending in the users lists. */
export const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INVITED: 'Pending',
  SUSPENDED: 'Suspended',
}

export function membershipStatusLabel(status: string) {
  return MEMBERSHIP_STATUS_LABELS[status] ?? status.toLowerCase()
}
