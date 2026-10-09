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

/**
 * Access matrix grouped like the home Apps launcher — one section per app so
 * inviting a user maps directly to what they will see on the dashboard.
 */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'pos',
    label: 'Point of Sale',
    description: 'Sell at the till — registers and checkout.',
    permissions: [
      { key: 'pos:read', label: 'Open POS and view registers' },
      { key: 'pos:sell', label: 'Ring up sales at the till' },
      { key: 'pos:manage', label: 'Configure payment methods and counters' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    description: 'Invoices, quotations, receipts, and credit memos.',
    permissions: [
      { key: 'invoice:read', label: 'View sales documents' },
      { key: 'invoice:create', label: 'Create sales documents' },
      { key: 'invoice:update', label: 'Edit sales documents' },
      { key: 'invoice:void', label: 'Void / delete sales documents' },
      { key: 'invoice:send', label: 'Send sales documents' },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    description: 'Who you sell to — customer list and profiles.',
    permissions: [
      { key: 'customer:read', label: 'View customers' },
      { key: 'customer:create', label: 'Create customers' },
      { key: 'customer:update', label: 'Edit customers' },
      { key: 'customer:archive', label: 'Archive customers' },
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    description: 'Bills, purchase orders, and receiving goods.',
    permissions: [
      { key: 'bill:read', label: 'View bills & purchase orders' },
      { key: 'bill:create', label: 'Create bills & receive goods' },
      { key: 'bill:update', label: 'Edit bills & purchase orders' },
      { key: 'bill:void', label: 'Void bills & purchase orders' },
    ],
  },
  {
    id: 'vendors',
    label: 'Vendors',
    description: 'Who you buy from — vendor list and profiles.',
    permissions: [
      { key: 'vendor:read', label: 'View vendors' },
      { key: 'vendor:create', label: 'Create vendors' },
      { key: 'vendor:update', label: 'Edit vendors' },
      { key: 'vendor:archive', label: 'Archive vendors' },
    ],
  },
  {
    id: 'banking',
    label: 'Banking',
    description: 'Bank accounts, transfers, deposits, and reconciliation.',
    permissions: [
      { key: 'bank:read', label: 'View bank accounts' },
      { key: 'bank:transact', label: 'Transfers & deposits' },
      { key: 'bank:import', label: 'Import bank statements' },
      { key: 'bank:reconcile', label: 'Reconcile bank accounts' },
    ],
  },
  {
    id: 'payments',
    label: 'Payments',
    description: 'Money received from customers.',
    permissions: [
      { key: 'payment:read', label: 'View customer payments' },
      { key: 'payment:create', label: 'Record customer payments' },
      { key: 'payment:update', label: 'Edit customer payments' },
      { key: 'payment:void', label: 'Void customer payments' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'Products, items, and stock on hand.',
    permissions: [
      { key: 'item:read', label: 'View items / products' },
      { key: 'item:create', label: 'Create items' },
      { key: 'item:update', label: 'Edit items' },
      { key: 'item:archive', label: 'Archive items' },
    ],
  },
  {
    id: 'stores',
    label: 'Store',
    description: 'Quantity by warehouse, transfers, and store tickets.',
    permissions: [
      { key: 'inventory:read', label: 'View stock & stores' },
      { key: 'inventory:adjust', label: 'Adjust, transfer & prepare tickets' },
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    description: 'Chart of accounts and the ledger.',
    permissions: [
      { key: 'account:read', label: 'View chart of accounts' },
      { key: 'account:create', label: 'Create accounts' },
      { key: 'account:update', label: 'Edit accounts' },
      { key: 'account:archive', label: 'Archive accounts' },
    ],
  },
  {
    id: 'journals',
    label: 'Journals',
    description: 'Manual journal entries.',
    permissions: [
      { key: 'journal:read', label: 'View journals' },
      { key: 'journal:create', label: 'Create journal entries' },
      { key: 'journal:post', label: 'Post journals' },
      { key: 'journal:reverse', label: 'Reverse journals' },
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
  {
    id: 'bill-payments',
    label: 'Bill payments',
    description: 'Money paid out — expenses and settling vendor bills.',
    permissions: [
      { key: 'expense:read', label: 'View expenses & bill payments' },
      { key: 'expense:create', label: 'Record expenses & bill payments' },
      { key: 'expense:update', label: 'Edit expenses & bill payments' },
      { key: 'expense:void', label: 'Void expenses & bill payments' },
    ],
  },
  {
    id: 'periods',
    label: 'Periods',
    description: 'Close and reopen the books.',
    permissions: [
      { key: 'period:read', label: 'View periods' },
      { key: 'period:close', label: 'Close periods' },
      { key: 'period:reopen', label: 'Reopen periods' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Organisation, users, tax, and the audit trail.',
    permissions: [
      { key: 'org:read', label: 'View organisation' },
      { key: 'org:update', label: 'Edit organisation settings' },
      { key: 'user:read', label: 'View users' },
      { key: 'user:invite', label: 'Invite users' },
      { key: 'user:update', label: 'Change roles & suspend users' },
      { key: 'user:remove', label: 'Remove users' },
      { key: 'tax:read', label: 'View tax codes' },
      { key: 'tax:manage', label: 'Manage tax codes' },
      { key: 'audit:read', label: 'View audit log' },
    ],
  },
]
