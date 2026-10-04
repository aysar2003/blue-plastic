import type { Permission } from '@/server/auth/permissions'
import type { LauncherIcon } from './launcher-apps'

/**
 * Destinations inside the Sales hub. Invoices, sales receipts, and quotations
 * open their home first; other document tiles open the create form so a sale
 * can start at once.
 */
export type SalesHubApp = {
  key: string
  label: string
  href: string
  icon: LauncherIcon
  permission?: Permission
  accent: string
  wash: string
  /** One-line purpose shown under the tile label on wider screens. */
  blurb: string
}

export const SALES_HUB_APPS: SalesHubApp[] = [
  {
    key: 'sales-receipts',
    label: 'Sales receipts',
    href: '/sales/sales-receipts',
    icon: 'receipt',
    permission: 'invoice:read',
    accent: '#0F766E',
    wash: '#CCFBF1',
    blurb: 'Paid on the spot',
  },
  {
    key: 'invoices',
    label: 'Invoices',
    href: '/sales/invoices',
    icon: 'notebook',
    permission: 'invoice:read',
    accent: '#1D4ED8',
    wash: '#DBEAFE',
    blurb: 'Customer owes you',
  },
  {
    key: 'quotations',
    label: 'Quotations',
    href: '/sales/estimates',
    icon: 'book',
    permission: 'invoice:read',
    accent: '#0369A1',
    wash: '#E0F2FE',
    blurb: 'Not posted yet',
  },
  {
    key: 'credit-memos',
    label: 'Credit memos',
    href: '/sales/credit-memos/new',
    icon: 'banknote',
    permission: 'invoice:create',
    accent: '#BE123C',
    wash: '#FFE4E6',
    blurb: 'Reduce what they owe',
  },
  {
    key: 'payments',
    label: 'Payments',
    href: '/payments/new',
    icon: 'hand-coins',
    permission: 'payment:create',
    accent: '#0E7490',
    wash: '#CFFAFE',
    blurb: 'Money received',
  },
  {
    key: 'customers',
    label: 'Customers',
    href: '/customers',
    icon: 'users',
    permission: 'customer:read',
    accent: '#B45309',
    wash: '#FEF3C7',
    blurb: 'Who you sell to',
  },
  {
    key: 'reports',
    label: 'Reports',
    href: '/sales/reports',
    icon: 'trending',
    permission: 'report:read',
    accent: '#7C2D12',
    wash: '#FFEDD5',
    blurb: 'Sales figures',
  },
]

export type SalesReportApp = {
  key: string
  label: string
  href: string
  icon: LauncherIcon
  accent: string
  wash: string
  blurb: string
}

/** Sales-facing reports only — the full catalogue still lives under Reports. */
export const SALES_REPORT_APPS: SalesReportApp[] = [
  {
    key: 'sales-by-customer',
    label: 'Sales by Customer Summary',
    href: '/reports/sales-by-customer',
    icon: 'users',
    accent: '#0369A1',
    wash: '#E0F2FE',
    blurb: 'Who buys most',
  },
  {
    key: 'sales-by-item',
    label: 'Sales by Product/Service Summary',
    href: '/reports/sales-by-item',
    icon: 'package',
    accent: '#1D4ED8',
    wash: '#DBEAFE',
    blurb: 'What sells',
  },
  {
    key: 'ar-aging',
    label: 'A/R Aging Summary',
    href: '/reports/ar-aging',
    icon: 'calendar',
    accent: '#BE123C',
    wash: '#FFE4E6',
    blurb: 'Who is overdue',
  },
  {
    key: 'open-invoices',
    label: 'Open invoices',
    href: '/reports/open-invoices',
    icon: 'notebook',
    accent: '#0F766E',
    wash: '#CCFBF1',
    blurb: 'Still unpaid',
  },
  {
    key: 'payments-received',
    label: 'Invoice Payment List',
    href: '/reports/payments-received',
    icon: 'hand-coins',
    accent: '#047857',
    wash: '#D1FAE5',
    blurb: 'Cash collected',
  },
  {
    key: 'customer-balances',
    label: 'Customer Balance Summary',
    href: '/reports/customer-balances',
    icon: 'wallet',
    accent: '#B45309',
    wash: '#FEF3C7',
    blurb: 'Owed per customer',
  },
  {
    key: 'statements',
    label: 'Customer Balance Detail',
    href: '/reports/statements/customer',
    icon: 'book',
    accent: '#334155',
    wash: '#F1F5F9',
    blurb: 'One customer, one period',
  },
  {
    key: 'product-profitability',
    label: 'Product Profitability',
    href: '/reports/product-profitability',
    icon: 'trending',
    accent: '#7C2D12',
    wash: '#FFEDD5',
    blurb: 'Income vs cost',
  },
]

export function salesAppsForPermissions(
  permissions: ReadonlySet<string> | Iterable<string>,
): SalesHubApp[] {
  const allowed = permissions instanceof Set ? permissions : new Set(permissions)
  return SALES_HUB_APPS.filter((app) => !app.permission || allowed.has(app.permission))
}
