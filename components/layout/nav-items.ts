import type { LucideIcon } from 'lucide-react'
import {
  BanknoteIcon,
  BookOpenIcon,
  CircleHelpIcon,
  LayoutGridIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
} from 'lucide-react'

import type { Permission } from '@/server/auth/permissions'

export type NavTab = {
  label: string
  href: string
  permission?: Permission
  /** Extra path prefixes that should light this tab up. */
  also?: string[]
}

export type NavModule = {
  key: string
  label: string
  /** Where the sidebar entry goes. */
  href: string
  icon: LucideIcon
  permission?: Permission
  /** Path prefixes that belong to this module. */
  owns: string[]
  tabs?: NavTab[]
  /**
   * Carries the current query string across the module's tabs. The report
   * screens share a period and a basis; losing them on every tab click would
   * make the tabs worse than a link.
   */
  preserveQuery?: boolean
}

/**
 * Nine modules, and everything else is a tab inside one of them.
 *
 * The sidebar used to list twenty-two destinations under five headings, which is
 * a table of contents rather than a navigation. A person doing the books thinks
 * in terms of *sales* or *purchases*; which document they need is the second
 * question, and the second question belongs on the page, not in the chrome.
 */
export const MODULES: NavModule[] = [
  {
    key: 'dashboard',
    label: 'Apps',
    href: '/dashboard',
    icon: LayoutGridIcon,
    owns: ['/dashboard'],
  },
  {
    key: 'sales',
    label: 'Sales',
    href: '/sales',
    icon: ReceiptIcon,
    permission: 'invoice:read',
    owns: ['/sales', '/payments', '/customers'],
    tabs: [
      { label: 'Home', href: '/sales' },
      { label: 'Estimates', href: '/sales/estimates', permission: 'invoice:read' },
      { label: 'Quotations', href: '/sales/quotations', permission: 'invoice:read' },
      { label: 'Invoices', href: '/sales/invoices', permission: 'invoice:read' },
      { label: 'Sales receipts', href: '/sales/sales-receipts', permission: 'invoice:read' },
      { label: 'Delivery', href: '/sales/delivery', permission: 'invoice:read' },
      { label: 'Credit memos', href: '/sales/credit-memos', permission: 'invoice:read' },
      { label: 'Payments', href: '/payments', permission: 'payment:read' },
      { label: 'Customers', href: '/customers', permission: 'customer:read' },
      { label: 'Reports', href: '/sales/reports', permission: 'report:read' },
    ],
  },
  {
    key: 'purchases',
    label: 'Purchases',
    href: '/purchases',
    icon: ShoppingCartIcon,
    permission: 'bill:read',
    owns: ['/purchases', '/bill-payments', '/vendors'],
    tabs: [
      { label: 'Home', href: '/purchases' },
      { label: 'Bills', href: '/purchases/bills', permission: 'bill:read' },
      {
        label: 'Expenses & receipts',
        href: '/purchases/expenses',
        permission: 'expense:read',
        also: ['/purchases/purchase-receipts'],
      },
      { label: 'Vendor credits', href: '/purchases/vendor-credits', permission: 'bill:read' },
      { label: 'Purchase orders', href: '/purchases/purchase-orders', permission: 'bill:read' },
      {
        label: 'Delivery',
        href: '/purchases/delivery',
        permission: 'bill:read',
        also: [
          '/purchases/delivery/outstanding',
          '/purchases/delivery/received',
          '/purchases/delivery/report',
        ],
      },
      { label: 'Bill payments', href: '/bill-payments', permission: 'expense:read' },
      { label: 'Vendors', href: '/vendors', permission: 'vendor:read' },
    ],
  },
  {
    key: 'banking',
    label: 'Banking',
    href: '/banking',
    icon: BanknoteIcon,
    permission: 'bank:read',
    owns: ['/banking'],
    tabs: [
      // Reconciling starts from an account rather than from a list, so there is
      // no /banking/reconcile index to link to — only a reconciliation in
      // progress has a page of its own.
      { label: 'Home', href: '/banking', permission: 'bank:read' },
      { label: 'Accounts', href: '/banking/accounts', permission: 'bank:read' },
      { label: 'New transfer', href: '/banking/transfers/new', permission: 'bank:transact' },
      { label: 'New deposit', href: '/banking/deposits/new', permission: 'bank:transact' },
      { label: 'Import a statement', href: '/banking/import', permission: 'bank:import' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    href: '/inventory',
    icon: PackageIcon,
    permission: 'item:read',
    owns: ['/inventory', '/items', '/stores'],
    tabs: [
      { label: 'Home', href: '/inventory' },
      { label: 'Products & services', href: '/items', permission: 'item:read' },
      { label: 'Stock on hand', href: '/inventory/stock', permission: 'inventory:read' },
      { label: 'Stores', href: '/stores', permission: 'inventory:read' },
      { label: 'Adjust stock', href: '/inventory/adjustments/new', permission: 'inventory:adjust' },
    ],
  },
  {
    key: 'accounting',
    label: 'Accounting',
    href: '/accounting',
    icon: BookOpenIcon,
    permission: 'account:read',
    owns: ['/accounting', '/accounts', '/journals', '/periods'],
    tabs: [
      { label: 'Home', href: '/accounting' },
      { label: 'Chart of accounts', href: '/accounts', permission: 'account:read' },
      { label: 'Journal entries', href: '/journals', permission: 'journal:read' },
      { label: 'Periods & year-end', href: '/periods', permission: 'period:read' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    href: '/reports',
    icon: TrendingUpIcon,
    permission: 'report:read',
    owns: ['/reports'],
    preserveQuery: true,
    // The sidebar lists the handful people open daily. Everything else — and
    // there are now thirty of them — lives on the index, grouped by the question
    // it answers, which is a better way to find one than a list of names.
    tabs: [
      { label: 'All reports', href: '/reports' },
      { label: 'Business overview', href: '/reports/business-overview', permission: 'report:overview' },
      { label: 'Profit and Loss', href: '/reports/profit-loss' },
      { label: 'Balance Sheet', href: '/reports/balance-sheet' },
      { label: 'Statement of Cash Flows', href: '/reports/cash-flow' },
      { label: 'Trial Balance', href: '/reports/trial-balance' },
      { label: 'Customer Balance Detail', href: '/reports/statements/customer', also: ['/reports/statements'] },
      { label: 'General Ledger', href: '/reports/general-ledger' },
      { label: 'Transaction Detail by Account', href: '/reports/transaction-detail' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: SettingsIcon,
    permission: 'org:read',
    owns: ['/settings'],
    tabs: [
      { label: 'Home', href: '/settings' },
      { label: 'Organisation', href: '/settings/organization' },
      { label: 'Configuration', href: '/settings/features', permission: 'org:update' },
      { label: 'Default accounts', href: '/settings/accounts', permission: 'account:read' },
      { label: 'Payment terms', href: '/settings/payment-terms' },
      { label: 'Tax', href: '/settings/tax', permission: 'tax:read' },
      { label: 'Users', href: '/settings/users', permission: 'user:read' },
      { label: 'Templates', href: '/settings/templates', permission: 'org:read' },
      { label: 'Appearance', href: '/settings/appearance' },
      { label: 'Your profile', href: '/settings/profile' },
      { label: 'Backup', href: '/settings/backup', permission: 'org:update' },
      { label: 'Activity log', href: '/settings/activity', permission: 'audit:read' },
    ],
  },
  {
    key: 'help',
    label: 'Help',
    href: '/help',
    icon: CircleHelpIcon,
    owns: ['/help'],
    tabs: [
      { label: 'Home', href: '/help' },
      { label: 'Guide', href: '/help/guide' },
      { label: 'Keyboard shortcuts', href: '/help/shortcuts' },
      { label: 'How the ledger works', href: '/help/ledger' },
    ],
  },
]

/** The module a path belongs to, by longest matching prefix. */
export function moduleFor(pathname: string): NavModule | undefined {
  let best: { entry: NavModule; length: number } | undefined

  for (const entry of MODULES) {
    for (const prefix of entry.owns) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        if (!best || prefix.length > best.length) best = { entry, length: prefix.length }
      }
    }
  }

  return best?.entry
}

/** The tab a path belongs to, by longest matching prefix. */
export function tabFor(section: NavModule, pathname: string): NavTab | undefined {
  let best: { tab: NavTab; length: number } | undefined

  for (const tab of section.tabs ?? []) {
    for (const prefix of [tab.href, ...(tab.also ?? [])]) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        if (!best || prefix.length > best.length) best = { tab, length: prefix.length }
      }
    }
  }

  return best?.tab
}
