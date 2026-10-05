/**
 * Permission catalog for the organisation — isomorphic so the invite/edit UI
 * can show every module, while the server matrix in `server/auth/permissions.ts`
 * remains the authority for role templates and enforcement.
 *
 * Pattern matches international ERP access control: grant by capability
 * (`invoice:create`), never by screen name.
 */

export const PERMISSIONS = [
  // Organisation and people
  'org:read',
  'org:update',
  'user:read',
  'user:invite',
  'user:update',
  'user:remove',
  'audit:read',

  // Chart of accounts and the ledger
  'account:read',
  'account:create',
  'account:update',
  'account:archive',
  'journal:read',
  'journal:create',
  'journal:post',
  'journal:reverse',
  'period:read',
  'period:close',
  'period:reopen',

  // Master data
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
  'tax:read',
  'tax:manage',

  // Point of sale
  'pos:read',
  'pos:sell',
  'pos:manage',

  // Sales
  'invoice:read',
  'invoice:create',
  'invoice:update',
  'invoice:void',
  'invoice:send',
  'payment:read',
  'payment:create',
  'payment:update',
  'payment:void',

  // Purchases
  'bill:read',
  'bill:create',
  'bill:update',
  'bill:void',
  'expense:read',
  'expense:create',
  'expense:update',
  'expense:void',

  // Banking
  'bank:read',
  'bank:transact',
  'bank:reconcile',
  'bank:import',

  // Inventory / stores
  'inventory:read',
  'inventory:adjust',

  // Reporting
  'report:read',
  'report:export',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value)
}

export type PermissionGroup = {
  id: string
  label: string
  description: string
  permissions: { key: Permission; label: string; hint?: string }[]
}

/** Modules shown when assigning access manually — one section per business area. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'organisation',
    label: 'Organisation & people',
    description: 'Company profile, users, and the audit trail.',
    permissions: [
      { key: 'org:read', label: 'View organisation' },
      { key: 'org:update', label: 'Edit organisation settings' },
      { key: 'user:read', label: 'View users' },
      { key: 'user:invite', label: 'Invite users' },
      { key: 'user:update', label: 'Change roles & suspend users' },
      { key: 'user:remove', label: 'Remove users' },
      { key: 'audit:read', label: 'View audit log' },
    ],
  },
  {
    id: 'ledger',
    label: 'Ledger & periods',
    description: 'Chart of accounts, journals, and fiscal periods.',
    permissions: [
      { key: 'account:read', label: 'View chart of accounts' },
      { key: 'account:create', label: 'Create accounts' },
      { key: 'account:update', label: 'Edit accounts' },
      { key: 'account:archive', label: 'Archive accounts' },
      { key: 'journal:read', label: 'View journals' },
      { key: 'journal:create', label: 'Create journal entries' },
      { key: 'journal:post', label: 'Post journals' },
      { key: 'journal:reverse', label: 'Reverse journals' },
      { key: 'period:read', label: 'View periods' },
      { key: 'period:close', label: 'Close periods' },
      { key: 'period:reopen', label: 'Reopen periods' },
    ],
  },
  {
    id: 'master',
    label: 'Customers, vendors & items',
    description: 'Master data used across sales, purchases, and stock.',
    permissions: [
      { key: 'customer:read', label: 'View customers' },
      { key: 'customer:create', label: 'Create customers' },
      { key: 'customer:update', label: 'Edit customers' },
      { key: 'customer:archive', label: 'Archive customers' },
      { key: 'vendor:read', label: 'View vendors' },
      { key: 'vendor:create', label: 'Create vendors' },
      { key: 'vendor:update', label: 'Edit vendors' },
      { key: 'vendor:archive', label: 'Archive vendors' },
      { key: 'item:read', label: 'View items' },
      { key: 'item:create', label: 'Create items' },
      { key: 'item:update', label: 'Edit items' },
      { key: 'item:archive', label: 'Archive items' },
      { key: 'tax:read', label: 'View tax codes' },
      { key: 'tax:manage', label: 'Manage tax codes' },
    ],
  },
  {
    id: 'pos',
    label: 'Point of sale',
    description: 'Tills, mobile wallets, and in-store checkout.',
    permissions: [
      { key: 'pos:read', label: 'Open POS and view registers' },
      { key: 'pos:sell', label: 'Ring up sales at the till' },
      { key: 'pos:manage', label: 'Configure payment methods and registers' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    description: 'Invoices, estimates, receipts, credit memos, and customer payments.',
    permissions: [
      { key: 'invoice:read', label: 'View sales documents' },
      { key: 'invoice:create', label: 'Create sales documents' },
      { key: 'invoice:update', label: 'Edit sales documents' },
      { key: 'invoice:void', label: 'Void / delete sales documents' },
      { key: 'invoice:send', label: 'Send sales documents' },
      { key: 'payment:read', label: 'View customer payments' },
      { key: 'payment:create', label: 'Record customer payments' },
      { key: 'payment:update', label: 'Edit customer payments' },
      { key: 'payment:void', label: 'Void customer payments' },
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    description: 'Bills, purchase orders, expenses, and receiving stock.',
    permissions: [
      { key: 'bill:read', label: 'View bills & purchase orders' },
      { key: 'bill:create', label: 'Create bills & receive goods' },
      { key: 'bill:update', label: 'Edit bills & purchase orders' },
      { key: 'bill:void', label: 'Void bills & purchase orders' },
      { key: 'expense:read', label: 'View expenses & bill payments' },
      { key: 'expense:create', label: 'Record expenses & bill payments' },
      { key: 'expense:update', label: 'Edit expenses & bill payments' },
      { key: 'expense:void', label: 'Void expenses & bill payments' },
    ],
  },
  {
    id: 'banking',
    label: 'Banking',
    description: 'Bank accounts, transfers, deposits, import, and reconciliation.',
    permissions: [
      { key: 'bank:read', label: 'View bank accounts' },
      { key: 'bank:transact', label: 'Transfers & deposits' },
      { key: 'bank:import', label: 'Import bank statements' },
      { key: 'bank:reconcile', label: 'Reconcile bank accounts' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory & stores',
    description: 'Stock levels, adjustments, transfers, and store tickets.',
    permissions: [
      { key: 'inventory:read', label: 'View stock & stores' },
      { key: 'inventory:adjust', label: 'Adjust, transfer & prepare tickets' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Financial and operational reports.',
    permissions: [
      { key: 'report:read', label: 'View reports' },
      { key: 'report:export', label: 'Export reports' },
    ],
  },
]
