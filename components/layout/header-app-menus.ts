import type { OrgFeatureFlags } from '@/lib/feature-flags'
import type { Permission } from '@/server/auth/permissions'
import {
  ACCOUNTING_HUB_APPS,
  BANKING_HUB_APPS,
  HELP_HUB_APPS,
  INVENTORY_HUB_APPS,
  PURCHASE_HUB_APPS,
  SETTINGS_HUB_APPS,
  visibleHubApps,
  type HubApp,
} from './module-hubs'
import { PROJECT_HUB_APPS, type ProjectHubApp } from './project-apps'
import { REPORT_SECTIONS } from './report-apps'
import { SALES_HUB_APPS, salesAppsForPermissions, type SalesHubApp } from './sales-apps'

/**
 * What opens under a top Apps chip on click.
 *
 * Work destinations stay here. Heavy / catalogue reports live under Reports
 * Centre (and each module’s Reports hub) — not as a long list on every menu.
 *
 * Reports uses expandable `children` groups (QuickBooks Desktop Report menu).
 */
export type HeaderMenuItem = {
  label: string
  href?: string
  blurb?: string
  permission?: Permission
  children?: HeaderMenuItem[]
}

/** QBD Report Centre category names mapped onto our catalogue sections. */
const QBD_SECTION_LABEL: Record<string, string> = {
  'Business overview': 'Company & Financial',
  'Who owes you': 'Customers & Receivables',
  'Sales and customers': 'Sales',
  'What you owe': 'Vendors & Payables',
  'Expenses and vendors': 'Purchases',
  'Sales tax': 'Sales Tax',
  'For my accountant': 'Accountant & Taxes',
  Inventory: 'Inventory',
  Banking: 'Banking',
  Budgets: 'Budgets',
  'Point of sale': 'Point of Sale',
  Projects: 'Jobs & Projects',
  'Data analysis': 'List',
}

function reportsMenuFromCatalogue(permissions: ReadonlySet<string>): HeaderMenuItem[] {
  const allowOverview = permissions.has('report:overview')
  const groups = REPORT_SECTIONS.filter((section) => {
    if (section.label === 'Business overview' && !allowOverview) {
      // Still show P&L / BS / TB without the overview tile.
      return true
    }
    return section.apps.length > 0
  }).map((section) => {
    const apps =
      section.label === 'Business overview' && !allowOverview
        ? section.apps.filter((app) => app.key !== 'business-overview')
        : section.apps
    return {
      label: QBD_SECTION_LABEL[section.label] ?? section.label,
      blurb: section.blurb,
      children: apps.map((app) => ({
        label: app.label,
        href: app.href,
        blurb: app.blurb,
      })),
    } satisfies HeaderMenuItem
  })

  return [
    { label: 'All reports', href: '/reports', permission: 'report:read' },
    { label: 'Memorized Reports', href: '/reports/custom', permission: 'report:read' },
    ...groups,
  ]
}

function fromHub(apps: HubApp[] | SalesHubApp[] | ProjectHubApp[]): HeaderMenuItem[] {
  return apps.map((app) => ({
    label: app.label,
    href: app.href,
    blurb: app.blurb,
    permission: app.permission,
  }))
}

const STATIC_MENUS: Record<string, HeaderMenuItem[]> = {
  pos: [
    { label: 'Dashboard', href: '/pos', permission: 'pos:read' },
    { label: 'Orders', href: '/pos/orders', permission: 'pos:read' },
    { label: 'Quotations', href: '/pos/quotations', permission: 'invoice:read' },
    { label: 'Sessions', href: '/pos/sessions', permission: 'pos:read' },
    { label: 'Configuration', href: '/pos/settings', permission: 'pos:manage' },
    { label: 'Estimates (Sales)', href: '/sales/estimates', permission: 'invoice:read' },
    { label: 'Quotations (Sales)', href: '/sales/quotations', permission: 'invoice:read' },
    { label: 'Sales receipts', href: '/sales/sales-receipts', permission: 'invoice:read' },
    { label: 'Transfer to bank', href: '/banking/transfers/new', permission: 'bank:transact' },
    { label: 'Reports', href: '/reports', permission: 'report:read' },
  ],
  sales: fromHub(SALES_HUB_APPS),
  projects: fromHub(PROJECT_HUB_APPS),
  purchases: fromHub(PURCHASE_HUB_APPS),
  banking: fromHub(BANKING_HUB_APPS),
  inventory: fromHub(INVENTORY_HUB_APPS),
  barcodes: [
    { label: 'Barcode desk', href: '/barcodes', permission: 'item:read' },
    { label: 'Print labels', href: '/barcodes/print', permission: 'item:read' },
    { label: 'Excel export', href: '/api/exports/barcodes', permission: 'item:read' },
    { label: 'Products', href: '/items', permission: 'item:read' },
  ],
  accounting: fromHub(ACCOUNTING_HUB_APPS),
  settings: fromHub(SETTINGS_HUB_APPS),
  help: fromHub(HELP_HUB_APPS),
  customers: [
    { label: 'All customers', href: '/customers', permission: 'customer:read' },
    { label: 'Portal users', href: '/customers/portal-users', permission: 'customer:read' },
    { label: 'Reports', href: '/sales/reports', permission: 'report:read' },
  ],
  vendors: [
    { label: 'All vendors', href: '/vendors', permission: 'vendor:read' },
    { label: 'Delivery', href: '/purchases/delivery', permission: 'bill:read' },
    { label: 'Reports', href: '/purchases/reports', permission: 'report:read' },
  ],
  payments: [
    { label: 'All payments', href: '/payments', permission: 'payment:read' },
    { label: 'Receive payment', href: '/payments/new', permission: 'payment:create' },
    { label: 'Reports', href: '/payments/reports', permission: 'report:read' },
  ],
  'bill-payments': [
    { label: 'All bill payments', href: '/bill-payments', permission: 'expense:read' },
    { label: 'Pay a bill', href: '/bill-payments/new', permission: 'expense:create' },
    { label: 'Reports', href: '/bill-payments/reports', permission: 'report:read' },
  ],
  journals: [
    { label: 'All journals', href: '/journals', permission: 'journal:read' },
    { label: 'New entry', href: '/journals/new', permission: 'journal:create' },
    { label: 'Reports', href: '/accounting/reports', permission: 'report:read' },
  ],
  periods: [
    { label: 'Periods', href: '/periods', permission: 'period:read' },
    { label: 'Reports', href: '/accounting/reports', permission: 'report:read' },
  ],
  calendar: [
    { label: 'Month view', href: '/calendar', permission: 'calendar:read' },
  ],
  databases: [
    { label: 'All databases', href: '/databases', permission: 'org:update' },
    { label: 'System users', href: '/databases/users', permission: 'org:update' },
    { label: 'Create company', href: '/databases?create=1', permission: 'org:update' },
    { label: 'Import backup', href: '/databases?import=1', permission: 'org:update' },
  ],
  stores: [
    { label: 'Office · stores', href: '/stores', permission: 'inventory:read' },
    { label: 'Stock on hand', href: '/inventory/stock', permission: 'inventory:read' },
  ],
  approvals: [
    { label: 'Pending', href: '/approvals', permission: 'invoice:approve' },
    { label: 'All approved', href: '/approvals/approved', permission: 'invoice:approve' },
    { label: 'Workflows', href: '/approvals/workflows', permission: 'org:update' },
    { label: 'Reports', href: '/approvals/reports', permission: 'report:read' },
  ],
  /** Built dynamically in menuForApp — QBD-style expandable categories. */
  reports: [],
}

/** Children for one top Apps chip, filtered by what the user may open. */
export function menuForApp(
  appKey: string,
  permissions: ReadonlySet<string> | Iterable<string>,
  features?: OrgFeatureFlags,
): HeaderMenuItem[] {
  const allowed = permissions instanceof Set ? permissions : new Set(permissions)

  if (appKey === 'reports') {
    if (!allowed.has('report:read')) return []
    return reportsMenuFromCatalogue(allowed)
  }

  const items = STATIC_MENUS[appKey]
  if (!items) return []

  if (appKey === 'sales') {
    return fromHub(salesAppsForPermissions(permissions, features))
  }
  if (appKey === 'purchases') {
    return fromHub(visibleHubApps(PURCHASE_HUB_APPS, permissions, features, 'purchases'))
  }
  if (appKey === 'inventory') {
    return fromHub(visibleHubApps(INVENTORY_HUB_APPS, permissions, features, 'inventory'))
  }

  // Hub lists already carry permissions; reuse the same filter.
  if (
    appKey === 'projects' ||
    appKey === 'banking' ||
    appKey === 'accounting' ||
    appKey === 'settings' ||
    appKey === 'help'
  ) {
    const hubs =
      appKey === 'projects'
        ? PROJECT_HUB_APPS
        : appKey === 'banking'
          ? BANKING_HUB_APPS
          : appKey === 'accounting'
            ? ACCOUNTING_HUB_APPS
            : appKey === 'settings'
              ? SETTINGS_HUB_APPS
              : HELP_HUB_APPS
    return fromHub(visibleHubApps(hubs, permissions))
  }

  return items.filter((item) => {
    if (item.permission && !allowed.has(item.permission)) return false
    return true
  })
}
