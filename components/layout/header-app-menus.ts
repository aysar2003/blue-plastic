import {
  CUSTOMERS_HUB_KIND,
  STORES_HUB_KIND,
  isDocumentKindEnabled,
  type OrgFeatureFlags,
} from '@/lib/feature-flags'
import type { Permission } from '@/server/auth/permissions'
import type { LauncherIcon } from './launcher-apps'
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
 * Hub rows carry the same icon mark used on the app home tiles when available.
 */
export type HeaderMenuItem = {
  label: string
  href?: string
  blurb?: string
  permission?: Permission
  icon?: LauncherIcon
  accent?: string
  wash?: string
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
        icon: app.icon,
        accent: app.accent,
        wash: app.wash,
      })),
    } satisfies HeaderMenuItem
  })

  return [
    {
      label: 'All reports',
      href: '/reports',
      permission: 'report:read',
      icon: 'trending',
      accent: '#0F766E',
      wash: '#CCFBF1',
    },
    {
      label: 'Memorized Reports',
      href: '/reports/custom',
      permission: 'report:read',
      icon: 'notebook',
      accent: '#4338CA',
      wash: '#E0E7FF',
    },
    ...groups,
  ]
}

function fromHub(apps: HubApp[] | SalesHubApp[] | ProjectHubApp[]): HeaderMenuItem[] {
  return apps.map((app) => ({
    label: app.label,
    href: app.href,
    blurb: app.blurb,
    permission: app.permission,
    icon: app.icon,
    accent: app.accent,
    wash: app.wash,
  }))
}

/** Static rows that are not hub tiles — still reuse launcher icon names when one fits. */
function row(
  label: string,
  href: string,
  icon: LauncherIcon,
  permission?: Permission,
  accent = '#64748b',
  wash = '#f1f5f9',
): HeaderMenuItem {
  return { label, href, permission, icon, accent, wash }
}

const STATIC_MENUS: Record<string, HeaderMenuItem[]> = {
  pos: [
    row('Dashboard', '/pos', 'monitor', 'pos:read', '#0891b2', '#cffafe'),
    row('Orders', '/pos/orders', 'receipt', 'pos:read', '#0F766E', '#CCFBF1'),
    row('Kitchen', '/pos/kitchen', 'clipboard', 'pos:read', '#C2410C', '#FFEDD5'),
    row('Tables', '/pos/tables', 'clipboard', 'pos:read', '#0369A1', '#E0F2FE'),
    row('Night audit', '/pos/night-audit', 'clock', 'pos:read', '#7C3AED', '#EDE9FE'),
    row('Quotations', '/pos/quotations', 'notebook', 'invoice:read', '#0891b2', '#ecfeff'),
    row('Sessions', '/pos/sessions', 'clock', 'pos:read', '#4338CA', '#E0E7FF'),
    row('Configuration', '/pos/settings', 'settings', 'pos:manage'),
    row('Estimates (Sales)', '/sales/estimates', 'book', 'invoice:read', '#22d3ee', '#cffafe'),
    row('Quotations (Sales)', '/sales/quotations', 'notebook', 'invoice:read', '#0891b2', '#ecfeff'),
    row('Sales receipts', '/sales/sales-receipts', 'receipt', 'invoice:read', '#0F766E', '#CCFBF1'),
    row('Transfer to bank', '/banking/transfers/new', 'transfer', 'bank:transact', '#0369A1', '#E0F2FE'),
    row('Reports', '/reports', 'trending', 'report:read', '#0F766E', '#CCFBF1'),
  ],
  sales: [
    ...fromHub(SALES_HUB_APPS),
    row('Hotel / hospitality', '/hospitality', 'building', 'invoice:read', '#0369A1', '#E0F2FE'),
  ],
  projects: fromHub(PROJECT_HUB_APPS),
  purchases: fromHub(PURCHASE_HUB_APPS),
  banking: fromHub(BANKING_HUB_APPS),
  inventory: fromHub(INVENTORY_HUB_APPS),
  barcodes: [
    row('Barcode desk', '/barcodes', 'barcode', 'item:read', '#B45309', '#FEF3C7'),
    row('Print labels', '/barcodes/print', 'file', 'item:read', '#0369A1', '#E0F2FE'),
    row('Excel export', '/api/exports/barcodes', 'scroll', 'item:read'),
    row('Products', '/items', 'package', 'item:read', '#0F766E', '#CCFBF1'),
  ],
  accounting: fromHub(ACCOUNTING_HUB_APPS),
  settings: fromHub(SETTINGS_HUB_APPS),
  help: fromHub(HELP_HUB_APPS),
  customers: [
    row('All customers', '/customers', 'users', 'customer:read', '#0369A1', '#E0F2FE'),
    row('Pipeline', '/customers/pipeline', 'trending', 'customer:read', '#0F766E', '#CCFBF1'),
    row('Tickets', '/customers/tickets', 'clipboard', 'customer:read', '#C2410C', '#FFEDD5'),
    row('Portal users', '/customers/portal-users', 'users', 'customer:read', '#4338CA', '#E0E7FF'),
    row('Reports', '/sales/reports', 'trending', 'report:read', '#0F766E', '#CCFBF1'),
  ],
  vendors: [
    row('All vendors', '/vendors', 'building', 'vendor:read', '#B45309', '#FEF3C7'),
    row('Delivery', '/purchases/delivery', 'package', 'bill:read', '#0F766E', '#CCFBF1'),
    row('Reports', '/purchases/reports', 'trending', 'report:read', '#0F766E', '#CCFBF1'),
  ],
  payments: [
    row('All payments', '/payments', 'hand-coins', 'payment:read', '#0F766E', '#CCFBF1'),
    row('Receive payment', '/payments/new', 'banknote', 'payment:create', '#0369A1', '#E0F2FE'),
    row('Reports', '/payments/reports', 'trending', 'report:read', '#0F766E', '#CCFBF1'),
  ],
  'bill-payments': [
    row('All bill payments', '/bill-payments', 'banknote', 'expense:read', '#B45309', '#FEF3C7'),
    row('Pay a bill', '/bill-payments/new', 'hand-coins', 'expense:create', '#C2410C', '#FFEDD5'),
    row('Reports', '/bill-payments/reports', 'trending', 'report:read', '#0F766E', '#CCFBF1'),
  ],
  journals: [
    row('All journals', '/journals', 'notebook', 'journal:read', '#4338CA', '#E0E7FF'),
    row('New entry', '/journals/new', 'book', 'journal:create', '#0F766E', '#CCFBF1'),
    row('Reports', '/accounting/reports', 'trending', 'report:read', '#0F766E', '#CCFBF1'),
  ],
  periods: [
    row('Periods', '/periods', 'calendar', 'period:read', '#0369A1', '#E0F2FE'),
    row('Reports', '/accounting/reports', 'trending', 'report:read', '#0F766E', '#CCFBF1'),
  ],
  calendar: [row('Month view', '/calendar', 'calendar', 'calendar:read', '#0369A1', '#E0F2FE')],
  databases: [
    row('All databases', '/databases', 'database', 'org:update', '#0F766E', '#CCFBF1'),
    row('Apps', '/databases/apps', 'sliders', 'org:update', '#0369A1', '#E0F2FE'),
    row('System users', '/databases/users', 'users', 'org:update', '#4338CA', '#E0E7FF'),
    row('Create company', '/databases?create=1', 'building', 'org:update', '#0F766E', '#CCFBF1'),
    row('Import backup', '/databases?import=1', 'package', 'org:update', '#B45309', '#FEF3C7'),
  ],
  stores: [
    row('Office · stores', '/stores', 'building', 'inventory:read', '#0369A1', '#E0F2FE'),
    row('Stock on hand', '/inventory/stock', 'package', 'inventory:read', '#0F766E', '#CCFBF1'),
    row('Pick tickets', '/stores/tickets', 'clipboard', 'inventory:read', '#C2410C', '#FFEDD5'),
  ],
  approvals: [
    row('Pending', '/approvals', 'clipboard', 'invoice:approve', '#C2410C', '#FFEDD5'),
    row('All approved', '/approvals/approved', 'scale', 'invoice:approve', '#0F766E', '#CCFBF1'),
    row('Workflows', '/approvals/workflows', 'sliders', 'org:update'),
    row('Reports', '/approvals/reports', 'trending', 'report:read', '#0F766E', '#CCFBF1'),
  ],
  /** Built dynamically in menuForApp — QBD-style expandable categories. */
  reports: [],
  analytics: [
    row('Analytics board', '/analytics', 'trending', 'report:overview', '#0F766E', '#CCFBF1'),
    row('Business overview', '/reports/business-overview', 'trending', 'report:overview', '#0369A1', '#E0F2FE'),
    row('AI brief (JSON)', '/api/analytics/brief', 'file', 'report:overview', '#4338CA', '#E0E7FF'),
    row('All reports', '/reports', 'trending', 'report:read', '#BE123C', '#FFE4E6'),
  ],
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
  if (appKey === 'accounting') {
    return fromHub(visibleHubApps(ACCOUNTING_HUB_APPS, permissions, features, 'accounting'))
  }
  if (appKey === 'projects' || appKey === 'banking' || appKey === 'settings' || appKey === 'help') {
    const hubs =
      appKey === 'projects'
        ? PROJECT_HUB_APPS
        : appKey === 'banking'
          ? BANKING_HUB_APPS
          : appKey === 'settings'
            ? SETTINGS_HUB_APPS
            : HELP_HUB_APPS
    return fromHub(visibleHubApps(hubs, permissions))
  }

  return items.filter((item) => {
    if (item.permission && !allowed.has(item.permission)) return false
    if (features && appKey === 'customers') {
      if (item.href?.includes('/pipeline') && !isDocumentKindEnabled(features, 'customers', 'pipeline')) {
        return false
      }
      if (
        item.href?.includes('/tickets') &&
        !isDocumentKindEnabled(features, 'customers', CUSTOMERS_HUB_KIND.tickets ?? 'tickets')
      ) {
        return false
      }
    }
    if (features && appKey === 'stores') {
      if (
        item.href?.includes('/stores/tickets') &&
        !isDocumentKindEnabled(features, 'stores', STORES_HUB_KIND.tickets ?? 'tickets')
      ) {
        return false
      }
    }
    return true
  })
}
