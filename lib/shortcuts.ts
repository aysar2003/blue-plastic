import type { Permission } from '@/server/auth/permissions'

/**
 * Every keyboard shortcut in the application, declared once.
 *
 * The palette, the key handler and the help page all read this list, so a
 * shortcut cannot work but be undocumented, or be documented but not work.
 *
 * The scheme is two-key sequences with a verb prefix — `g` to go somewhere, `c`
 * to create something, `o` to open a board or secondary module — which is what
 * people who use a keyboard already expect and which leaves single letters free
 * for the page itself. Nothing is bound to a bare modifier chord except the
 * palette.
 */
export type Shortcut = {
  /** The keys pressed in order, e.g. ['g', 'i']. */
  keys: string[]
  label: string
  href: string
  permission?: Permission
  group: 'Go to' | 'Create' | 'Open'
}

export const SHORTCUTS: Shortcut[] = [
  // --- Go to (core day-to-day) ---------------------------------------------
  { keys: ['g', 'd'], label: 'Apps', href: '/dashboard', group: 'Go to' },
  { keys: ['g', 'x'], label: 'Sales', href: '/sales', permission: 'invoice:read', group: 'Go to' },
  { keys: ['g', 'i'], label: 'Invoices', href: '/sales/invoices?status=open', permission: 'invoice:read', group: 'Go to' },
  { keys: ['g', 'q'], label: 'Quotations', href: '/sales/quotations', permission: 'invoice:read', group: 'Go to' },
  { keys: ['g', 'u'], label: 'Sales receipts', href: '/sales/sales-receipts', permission: 'invoice:read', group: 'Go to' },
  { keys: ['g', 'm'], label: 'Credit memos', href: '/sales/credit-memos', permission: 'invoice:read', group: 'Go to' },
  { keys: ['g', 'y'], label: 'Payments', href: '/payments', permission: 'payment:read', group: 'Go to' },
  { keys: ['g', 'c'], label: 'Customers', href: '/customers', permission: 'customer:read', group: 'Go to' },
  { keys: ['g', 'w'], label: 'Purchases', href: '/purchases', permission: 'bill:read', group: 'Go to' },
  { keys: ['g', 'b'], label: 'Bills', href: '/purchases/bills', permission: 'bill:read', group: 'Go to' },
  { keys: ['g', 'e'], label: 'Expenses', href: '/purchases/expenses', permission: 'expense:read', group: 'Go to' },
  { keys: ['g', 'v'], label: 'Vendors', href: '/vendors', permission: 'vendor:read', group: 'Go to' },
  { keys: ['g', 'k'], label: 'Banking', href: '/banking', permission: 'bank:read', group: 'Go to' },
  { keys: ['g', 'o'], label: 'Accounting', href: '/accounting', permission: 'account:read', group: 'Go to' },
  { keys: ['g', 'a'], label: 'Chart of accounts', href: '/accounts', permission: 'account:read', group: 'Go to' },
  { keys: ['g', 'j'], label: 'Journal entries', href: '/journals', permission: 'journal:read', group: 'Go to' },
  { keys: ['g', 'l'], label: 'Periods', href: '/periods', permission: 'period:read', group: 'Go to' },
  { keys: ['g', 'n'], label: 'Products and services', href: '/items', permission: 'item:read', group: 'Go to' },
  { keys: ['g', 'r'], label: 'Reports', href: '/reports', permission: 'report:read', group: 'Go to' },
  { keys: ['g', 'p'], label: 'Profit and Loss', href: '/reports/profit-loss', permission: 'report:read', group: 'Go to' },
  { keys: ['g', 'f'], label: 'Balance Sheet', href: '/reports/balance-sheet', permission: 'report:read', group: 'Go to' },
  { keys: ['g', 't'], label: 'Trial Balance', href: '/reports/trial-balance', permission: 'report:read', group: 'Go to' },
  { keys: ['g', 'z'], label: 'Projects', href: '/projects', permission: 'project:read', group: 'Go to' },
  { keys: ['g', 's'], label: 'Settings', href: '/settings', permission: 'org:read', group: 'Go to' },
  { keys: ['g', 'h'], label: 'Help', href: '/help', group: 'Go to' },

  // --- Open (boards & secondary modules) ----------------------------------
  { keys: ['o', 'i'], label: 'Inventory', href: '/inventory', permission: 'item:read', group: 'Open' },
  { keys: ['o', 't'], label: 'Stock on hand', href: '/inventory/stock', permission: 'inventory:read', group: 'Open' },
  { keys: ['o', 's'], label: 'Company Snapshot', href: '/reports/snapshot', permission: 'report:overview', group: 'Open' },
  { keys: ['o', 'b'], label: 'Business overview', href: '/reports/business-overview', permission: 'report:overview', group: 'Open' },
  { keys: ['o', 'a'], label: 'Analytics', href: '/analytics', permission: 'report:overview', group: 'Open' },
  { keys: ['o', 'c'], label: 'Cash Flow', href: '/reports/cash-flow', permission: 'report:read', group: 'Open' },
  { keys: ['o', 'r'], label: 'A/R Aging', href: '/reports/ar-aging', permission: 'report:read', group: 'Open' },
  { keys: ['o', 'p'], label: 'Point of Sale', href: '/pos', permission: 'pos:read', group: 'Open' },
  { keys: ['o', 'k'], label: 'Calendar', href: '/calendar', permission: 'calendar:read', group: 'Open' },
  { keys: ['o', 'h'], label: 'Keyboard shortcuts', href: '/help/shortcuts', group: 'Open' },

  // --- Create --------------------------------------------------------------
  { keys: ['c', 'i'], label: 'New invoice', href: '/sales/invoices/new', permission: 'invoice:create', group: 'Create' },
  { keys: ['c', 'r'], label: 'New sales receipt', href: '/sales/sales-receipts/new', permission: 'invoice:create', group: 'Create' },
  { keys: ['c', 'q'], label: 'New quotation', href: '/sales/quotations/new', permission: 'invoice:create', group: 'Create' },
  { keys: ['c', 's'], label: 'New estimate', href: '/sales/estimates/new', permission: 'invoice:create', group: 'Create' },
  { keys: ['c', 'm'], label: 'New credit memo', href: '/sales/credit-memos/new', permission: 'invoice:create', group: 'Create' },
  { keys: ['c', 'f'], label: 'New refund receipt', href: '/sales/refunds/new', permission: 'invoice:create', group: 'Create' },
  { keys: ['c', 'p'], label: 'Receive a payment', href: '/payments/new', permission: 'payment:create', group: 'Create' },
  { keys: ['c', 'b'], label: 'New bill', href: '/purchases/bills/new', permission: 'bill:create', group: 'Create' },
  { keys: ['c', 'e'], label: 'New expense', href: '/purchases/expenses/new', permission: 'expense:create', group: 'Create' },
  { keys: ['c', 'o'], label: 'New purchase order', href: '/purchases/purchase-orders/new', permission: 'bill:create', group: 'Create' },
  { keys: ['c', 'y'], label: 'New vendor credit', href: '/purchases/vendor-credits/new', permission: 'bill:create', group: 'Create' },
  { keys: ['c', 'u'], label: 'Pay bills', href: '/bill-payments/new', permission: 'expense:create', group: 'Create' },
  { keys: ['c', 'd'], label: 'New bank deposit', href: '/banking/deposits/new', permission: 'bank:transact', group: 'Create' },
  { keys: ['c', 't'], label: 'New transfer', href: '/banking/transfers/new', permission: 'bank:transact', group: 'Create' },
  { keys: ['c', 'j'], label: 'New journal entry', href: '/journals/new', permission: 'journal:create', group: 'Create' },
  { keys: ['c', 'n'], label: 'Adjust stock', href: '/inventory/adjustments/new', permission: 'inventory:adjust', group: 'Create' },
  { keys: ['c', 'k'], label: 'New project', href: '/projects/new', permission: 'project:create', group: 'Create' },
]

/** Shortcuts that are not navigation, listed for the help page only. */
export const GLOBAL_KEYS: { keys: string; label: string }[] = [
  { keys: 'Ctrl K', label: 'Search the whole system' },
  { keys: '?', label: 'Show keyboard shortcuts' },
  { keys: '/', label: 'Jump to the search box on the page' },
  { keys: 'g then …', label: 'Go to a page (second key chooses which)' },
  { keys: 'c then …', label: 'Create a document (second key chooses which)' },
  { keys: 'o then …', label: 'Open a board or module (Inventory, Snapshot, POS…)' },
  { keys: 'Ctrl S', label: 'Save and close (invoice, bill, and every other form)' },
  { keys: 'Ctrl Shift S', label: 'Save and start another blank form' },
  { keys: 'Ctrl L', label: 'Add a line on the document you are filling in' },
  { keys: 'Enter', label: 'Accept a name in a picker, then move to the next field on the line' },
  { keys: '↑ ↓', label: 'Move through the rows of a list or a picker' },
  { keys: 'j / k', label: 'Move down / up a list without the mouse' },
  { keys: 'Esc', label: 'Leave a field, or close a dialog' },
  { keys: 'Tab', label: 'Accept the highlighted name and move to the next field' },
]

/** How a key sequence is written on screen. */
export const formatKeys = (keys: string[]) => keys.map((key) => key.toUpperCase()).join(' then ')

/** Label shown in the bottom hint bar while a two-key sequence is open. */
export function sequenceGroupLabel(prefix: string | null): string {
  if (prefix === 'c') return 'Create'
  if (prefix === 'o') return 'Open'
  return 'Go to'
}
