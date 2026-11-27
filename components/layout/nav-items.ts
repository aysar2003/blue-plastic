import type { LucideIcon } from 'lucide-react'
import {
  BanknoteIcon,
  BookOpenIcon,
  CalendarRangeIcon,
  CircleHelpIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  DatabaseIcon,
  LayoutGridIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  UsersIcon,
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
 * Top-level modules; everything else is a tab inside one of them.
 *
 * A person doing the books thinks in terms of *sales* or *purchases*; which
 * document they need is the second question, and belongs on the page, not in
 * the chrome.
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
      { label: 'Sales orders', href: '/sales/sales-orders', permission: 'invoice:read' },
      { label: 'Invoices', href: '/sales/invoices?status=open', permission: 'invoice:read' },
      { label: 'Subscriptions', href: '/sales/subscriptions', permission: 'invoice:read' },
      { label: 'Dunning', href: '/sales/subscriptions/dunning', permission: 'invoice:read' },
      { label: 'Service jobs', href: '/service/jobs', permission: 'invoice:read' },
      { label: 'Sales receipts', href: '/sales/sales-receipts', permission: 'invoice:read' },
      { label: 'Delivery', href: '/sales/delivery', permission: 'invoice:read' },
      { label: 'Credit memos', href: '/sales/credit-memos', permission: 'invoice:read' },
      { label: 'Payments', href: '/payments', permission: 'payment:read' },
      { label: 'Customers', href: '/customers', permission: 'customer:read' },
      { label: 'Pipeline', href: '/customers/pipeline', permission: 'customer:read' },
      { label: 'Tickets', href: '/customers/tickets', permission: 'customer:read' },
      { label: 'Portal users', href: '/customers/portal-users', permission: 'customer:read' },
      { label: 'Reports', href: '/sales/reports', permission: 'report:read' },
    ],
  },
  {
    key: 'projects',
    label: 'Projects',
    href: '/projects',
    icon: ClipboardListIcon,
    permission: 'project:read',
    owns: ['/projects'],
    tabs: [
      { label: 'Overview', href: '/projects' },
      { label: 'All projects', href: '/projects/list', permission: 'project:read' },
      { label: 'New', href: '/projects/new', permission: 'project:create' },
      { label: 'Reports', href: '/projects/reports', permission: 'report:read' },
      { label: 'WIP', href: '/projects/wip', permission: 'invoice:create' },
      { label: 'Progress', href: '/projects/progress', permission: 'invoice:create' },
      { label: 'Contracts', href: '/projects/contracts', permission: 'invoice:read' },
      { label: 'My tasks', href: '/projects/my-tasks', permission: 'project:read' },
      { label: 'My timesheets', href: '/projects/timesheets', permission: 'project:read' },
    ],
  },
  {
    key: 'quality',
    label: 'Quality',
    href: '/quality/capa',
    icon: ClipboardListIcon,
    permission: 'audit:read',
    owns: ['/quality'],
    tabs: [{ label: 'CAPA', href: '/quality/capa', permission: 'audit:read' }],
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
        label: 'Purchase requests',
        href: '/purchases/purchase-requests',
        permission: 'bill:read',
      },
      { label: 'RFQs', href: '/purchases/rfqs', permission: 'bill:read' },
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
      { label: 'Landed costs', href: '/purchases/landed-costs', permission: 'bill:read' },
      { label: 'Vendors', href: '/vendors', permission: 'vendor:read' },
      { label: 'Reports', href: '/purchases/reports', permission: 'report:read' },
    ],
  },
  {
    key: 'banking',
    label: 'Banking',
    href: '/banking',
    icon: BanknoteIcon,
    permission: 'bank:read',
    owns: ['/banking', '/insurance'],
    tabs: [
      // Reconciling starts from an account rather than from a list, so there is
      // no /banking/reconcile index to link to — only a reconciliation in
      // progress has a page of its own.
      { label: 'Home', href: '/banking', permission: 'bank:read' },
      { label: 'Accounts', href: '/banking/accounts', permission: 'bank:read' },
      { label: 'New transfer', href: '/banking/transfers/new', permission: 'bank:transact' },
      { label: 'New deposit', href: '/banking/deposits/new', permission: 'bank:transact' },
      { label: 'Import a statement', href: '/banking/import', permission: 'bank:import' },
      { label: 'Loans', href: '/banking/loans', permission: 'customer:read' },
      {
        label: 'Insurance',
        href: '/insurance/policies',
        permission: 'customer:read',
        also: ['/insurance', '/banking/insurance'],
      },
      { label: 'Reports', href: '/banking/reports', permission: 'report:read' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    href: '/inventory',
    icon: PackageIcon,
    permission: 'item:read',
    owns: ['/inventory', '/items', '/stores', '/barcodes'],
    tabs: [
      { label: 'Home', href: '/inventory' },
      { label: 'Products & services', href: '/items', permission: 'item:read' },
      { label: 'Stock on hand', href: '/inventory/stock', permission: 'inventory:read' },
      { label: 'Replenish', href: '/inventory/replenish', permission: 'inventory:adjust' },
      { label: 'Stores', href: '/stores', permission: 'inventory:read' },
      { label: 'Barcodes', href: '/barcodes', permission: 'item:read' },
      { label: 'Adjust stock', href: '/inventory/adjustments/new', permission: 'inventory:adjust' },
      { label: 'Build assemblies', href: '/inventory/builds/new', permission: 'inventory:adjust' },
      { label: 'Work orders', href: '/inventory/work-orders', permission: 'inventory:read' },
      { label: 'Materials plan', href: '/inventory/mrp', permission: 'inventory:read' },
      { label: 'Bins & picks', href: '/inventory/bins', permission: 'inventory:read' },
      { label: 'Reports', href: '/inventory/reports', permission: 'report:read' },
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
    key: 'analytics',
    label: 'Analytics',
    href: '/analytics',
    icon: TrendingUpIcon,
    permission: 'report:overview',
    owns: ['/analytics'],
    tabs: [
      { label: 'Board', href: '/analytics', permission: 'report:overview' },
      { label: 'All reports', href: '/reports', permission: 'report:read' },
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
    // Daily doors only. The full catalogue lives on /reports, grouped by question.
    tabs: [
      { label: 'All reports', href: '/reports' },
      { label: 'Company Snapshot', href: '/reports/snapshot', permission: 'report:overview' },
      { label: 'Business overview', href: '/reports/business-overview', permission: 'report:overview' },
      { label: 'Profit and Loss', href: '/reports/profit-loss' },
      { label: 'Balance Sheet', href: '/reports/balance-sheet' },
      { label: 'Cash Flow', href: '/reports/cash-flow' },
      { label: 'A/R Aging', href: '/reports/ar-aging' },
      { label: 'Trial Balance', href: '/reports/trial-balance' },
    ],
  },
  {
    key: 'employees',
    label: 'Employees',
    href: '/employees',
    icon: UsersIcon,
    permission: 'hr:read',
    owns: ['/employees'],
    tabs: [
      { label: 'Directory', href: '/employees', permission: 'hr:read' },
      { label: 'Recruitment', href: '/employees/recruitment', permission: 'hr:read' },
      { label: 'Training', href: '/employees/training', permission: 'hr:read' },
      { label: 'Contracts', href: '/employees/contracts', permission: 'hr:read' },
      { label: 'Leave', href: '/employees/leave', permission: 'hr:leave' },
      { label: 'Attendance', href: '/employees/attendance', permission: 'hr:attendance' },
      { label: 'Payroll', href: '/employees/payroll', permission: 'hr:payroll' },
      { label: 'My payslips', href: '/employees/payroll/mine', permission: 'hr:read' },
      { label: 'Settings', href: '/employees/settings', permission: 'hr:read' },
      { label: 'Budget', href: '/employees/budget', permission: 'hr:read' },
      { label: 'Policies', href: '/employees/policies', permission: 'hr:read' },
      { label: 'Guide', href: '/employees/guide', permission: 'hr:read' },
    ],
  },
  {
    key: 'approvals',
    label: 'Approvals',
    href: '/approvals',
    icon: ClipboardCheckIcon,
    permission: 'invoice:approve',
    owns: ['/approvals'],
    tabs: [
      { label: 'Pending', href: '/approvals', permission: 'invoice:approve' },
      { label: 'All approved', href: '/approvals/approved', permission: 'invoice:approve' },
      { label: 'Workflows', href: '/approvals/workflows', permission: 'org:update' },
      { label: 'Reports', href: '/approvals/reports', permission: 'report:read' },
    ],
  },
  {
    key: 'calendar',
    label: 'Calendar',
    href: '/calendar',
    icon: CalendarRangeIcon,
    permission: 'calendar:read',
    owns: ['/calendar', '/appointments'],
    tabs: [
      { label: 'Calendar', href: '/calendar', permission: 'calendar:read' },
      { label: 'Appointments', href: '/appointments', permission: 'calendar:read' },
    ],
  },
  {
    key: 'databases',
    label: 'Databases',
    href: '/databases',
    icon: DatabaseIcon,
    permission: 'org:update',
    owns: ['/databases', '/settings/backup'],
    tabs: [
      { label: 'Home', href: '/databases' },
      { label: 'Activity', href: '/databases/activity' },
      { label: 'Apps', href: '/databases/apps' },
      { label: 'System users', href: '/databases/users' },
      { label: 'Platform billing', href: '/databases/billing' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: SettingsIcon,
    permission: 'org:read',
    owns: ['/settings', '/billing'],
    tabs: [
      { label: 'Home', href: '/settings' },
      { label: 'Organisation', href: '/settings/organization' },
      { label: 'Extensions', href: '/settings/extensions', permission: 'org:read' },
      { label: 'Billing', href: '/billing', permission: 'org:read' },
      { label: 'Apps & features', href: '/settings/features', permission: 'org:update' },
      { label: 'Marketplace', href: '/settings/marketplace', permission: 'org:update' },
      { label: 'Price lists & promos', href: '/settings/pricing', permission: 'item:update' },
      { label: 'Default accounts', href: '/settings/accounts', permission: 'account:read' },
      { label: 'Payment terms', href: '/settings/payment-terms' },
      { label: 'Classes', href: '/settings/classes' },
      { label: 'Tax', href: '/settings/tax', permission: 'tax:read' },
      { label: 'Company users', href: '/settings/users', permission: 'user:read' },
      { label: 'Team performance', href: '/settings/user-performance', permission: 'user:read' },
      { label: 'User history', href: '/settings/user-history', permission: 'user:read' },
      { label: 'Templates', href: '/settings/templates', permission: 'org:read' },
      { label: 'Appearance', href: '/settings/appearance' },
      { label: 'Your profile', href: '/settings/profile' },
      { label: 'Trash', href: '/settings/activity', permission: 'audit:read' },
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
      { label: 'Hagitaan', href: '/help/guide-so' },
      { label: 'User manual', href: '/help/manual' },
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
  const path = pathname.split(/[?#]/)[0] || pathname
  let best: { tab: NavTab; length: number } | undefined

  for (const tab of section.tabs ?? []) {
    for (const raw of [tab.href, ...(tab.also ?? [])]) {
      // Tab hrefs may carry a default query (`?status=open`); match on the path only.
      const prefix = raw.split(/[?#]/)[0] || raw
      if (path === prefix || path.startsWith(`${prefix}/`)) {
        if (!best || prefix.length > best.length) best = { tab, length: prefix.length }
      }
    }
  }

  return best?.tab
}
