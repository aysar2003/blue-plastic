import type { Permission } from '@/server/auth/permissions'

/**
 * Every keyboard shortcut in the application, declared once.
 *
 * The palette, the key handler and the help page all read this list, so a
 * shortcut cannot work but be undocumented, or be documented but not work.
 *
 * The scheme is two-key sequences with a verb prefix — `g` to go somewhere, `c`
 * to create something — which is what people who use a keyboard already expect
 * and which leaves single letters free for the page itself. Nothing is bound to
 * a bare modifier chord except the palette.
 */
export type Shortcut = {
  /** The keys pressed in order, e.g. ['g', 'i']. */
  keys: string[]
  label: string
  href: string
  permission?: Permission
  group: 'Go to' | 'Create'
}

export const SHORTCUTS: Shortcut[] = [
  { keys: ['g', 'd'], label: 'Apps', href: '/dashboard', group: 'Go to' },
  { keys: ['g', 'i'], label: 'Invoices', href: '/sales/invoices', permission: 'invoice:read', group: 'Go to' },
  { keys: ['g', 'b'], label: 'Bills', href: '/purchases/bills', permission: 'bill:read', group: 'Go to' },
  { keys: ['g', 'c'], label: 'Customers', href: '/customers', permission: 'customer:read', group: 'Go to' },
  { keys: ['g', 'v'], label: 'Vendors', href: '/vendors', permission: 'vendor:read', group: 'Go to' },
  { keys: ['g', 'k'], label: 'Banking', href: '/banking', permission: 'bank:read', group: 'Go to' },
  { keys: ['g', 'a'], label: 'Chart of accounts', href: '/accounts', permission: 'account:read', group: 'Go to' },
  { keys: ['g', 'j'], label: 'Journal entries', href: '/journals', permission: 'journal:read', group: 'Go to' },
  { keys: ['g', 'r'], label: 'Reports', href: '/reports', permission: 'report:read', group: 'Go to' },
  { keys: ['g', 'p'], label: 'Profit & loss', href: '/reports/profit-loss', permission: 'report:read', group: 'Go to' },
  { keys: ['g', 's'], label: 'Settings', href: '/settings/organization', permission: 'org:read', group: 'Go to' },

  { keys: ['c', 'i'], label: 'New invoice', href: '/sales/invoices/new', permission: 'invoice:create', group: 'Create' },
  { keys: ['c', 'b'], label: 'New bill', href: '/purchases/bills/new', permission: 'bill:create', group: 'Create' },
  { keys: ['c', 'e'], label: 'New expense', href: '/purchases/expenses/new', permission: 'expense:create', group: 'Create' },
  { keys: ['c', 'p'], label: 'Receive a payment', href: '/payments/new', permission: 'payment:create', group: 'Create' },
  { keys: ['c', 'j'], label: 'New journal entry', href: '/journals/new', permission: 'journal:create', group: 'Create' },
]

/** Shortcuts that are not navigation, listed for the help page only. */
export const GLOBAL_KEYS: { keys: string; label: string }[] = [
  { keys: '⌘K / Ctrl K', label: 'Open the command palette' },
  { keys: '?', label: 'Show keyboard shortcuts' },
  { keys: '/', label: 'Jump to the search box on the page' },
  { keys: 'Esc', label: 'Close a dialog or a menu' },
]

/** How a key sequence is written on screen. */
export const formatKeys = (keys: string[]) => keys.map((key) => key.toUpperCase()).join(' then ')
