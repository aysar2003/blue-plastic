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
import { SALES_HUB_APPS, type SalesHubApp } from './sales-apps'

/**
 * What opens under a top Apps chip on click.
 *
 * Each parent app lists the destinations inside it, so a person can jump
 * straight to Delivery or Invoices without opening the hub first.
 */
export type HeaderMenuItem = {
  label: string
  href: string
  blurb?: string
  permission?: Permission
}

function fromHub(apps: HubApp[] | SalesHubApp[]): HeaderMenuItem[] {
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
  ],
  sales: fromHub(SALES_HUB_APPS),
  purchases: fromHub(PURCHASE_HUB_APPS),
  banking: fromHub(BANKING_HUB_APPS),
  inventory: fromHub(INVENTORY_HUB_APPS),
  accounting: fromHub(ACCOUNTING_HUB_APPS),
  settings: fromHub(SETTINGS_HUB_APPS),
  help: fromHub(HELP_HUB_APPS),
  customers: [
    { label: 'All customers', href: '/customers', permission: 'customer:read' },
    { label: 'Customer statements', href: '/reports/statements/customer', permission: 'report:read' },
    { label: 'A/R aging', href: '/reports/ar-aging', permission: 'report:read' },
  ],
  vendors: [
    { label: 'All vendors', href: '/vendors', permission: 'vendor:read' },
    { label: 'Delivery', href: '/purchases/delivery', permission: 'bill:read' },
    { label: 'Vendor statements', href: '/reports/statements/vendor', permission: 'report:read' },
    { label: 'A/P aging', href: '/reports/ap-aging', permission: 'report:read' },
  ],
  payments: [
    { label: 'All payments', href: '/payments', permission: 'payment:read' },
    { label: 'Receive payment', href: '/payments/new', permission: 'payment:create' },
  ],
  'bill-payments': [
    { label: 'All bill payments', href: '/bill-payments', permission: 'expense:read' },
    { label: 'Pay a bill', href: '/bill-payments/new', permission: 'expense:create' },
  ],
  journals: [
    { label: 'All journals', href: '/journals', permission: 'journal:read' },
    { label: 'New entry', href: '/journals/new', permission: 'journal:create' },
  ],
  periods: [
    { label: 'Periods', href: '/periods', permission: 'period:read' },
  ],
  stores: [
    { label: 'Office · stores', href: '/stores', permission: 'inventory:read' },
    { label: 'Stock on hand', href: '/inventory/stock', permission: 'inventory:read' },
  ],
  reports: [
    { label: 'All reports', href: '/reports', permission: 'report:read' },
    { label: 'Profit and Loss', href: '/reports/profit-loss', permission: 'report:read' },
    { label: 'Balance Sheet', href: '/reports/balance-sheet', permission: 'report:read' },
    { label: 'Cash Flow', href: '/reports/cash-flow', permission: 'report:read' },
    { label: 'Trial Balance', href: '/reports/trial-balance', permission: 'report:read' },
    { label: 'A/R Aging', href: '/reports/ar-aging', permission: 'report:read' },
    { label: 'A/P Aging', href: '/reports/ap-aging', permission: 'report:read' },
    { label: 'General Ledger', href: '/reports/general-ledger', permission: 'report:read' },
    { label: 'Purchase delivery', href: '/purchases/delivery/report', permission: 'bill:read' },
  ],
}

/** Children for one top Apps chip, filtered by what the user may open. */
export function menuForApp(
  appKey: string,
  permissions: ReadonlySet<string> | Iterable<string>,
): HeaderMenuItem[] {
  const items = STATIC_MENUS[appKey]
  if (!items) return []

  // Hub lists already carry permissions; reuse the same filter.
  if (
    appKey === 'sales' ||
    appKey === 'purchases' ||
    appKey === 'banking' ||
    appKey === 'inventory' ||
    appKey === 'accounting' ||
    appKey === 'settings' ||
    appKey === 'help'
  ) {
    const hubs =
      appKey === 'sales'
        ? SALES_HUB_APPS
        : appKey === 'purchases'
          ? PURCHASE_HUB_APPS
          : appKey === 'banking'
            ? BANKING_HUB_APPS
            : appKey === 'inventory'
              ? INVENTORY_HUB_APPS
              : appKey === 'accounting'
                ? ACCOUNTING_HUB_APPS
                : appKey === 'settings'
                  ? SETTINGS_HUB_APPS
                  : HELP_HUB_APPS
    return fromHub(visibleHubApps(hubs, permissions))
  }

  const allowed = permissions instanceof Set ? permissions : new Set(permissions)
  return items.filter((item) => !item.permission || allowed.has(item.permission))
}
