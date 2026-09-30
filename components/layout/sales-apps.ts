import type { Permission } from '@/server/auth/permissions'
import type { LauncherIcon } from './launcher-apps'

/**
 * Destinations inside the Sales hub. Document tiles open the create form so the
 * person can enter a sale immediately; lists stay reachable from those screens.
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
    href: '/sales/sales-receipts/new',
    icon: 'receipt',
    permission: 'invoice:create',
    accent: '#0F766E',
    wash: '#CCFBF1',
    blurb: 'Paid on the spot',
  },
  {
    key: 'invoices',
    label: 'Invoices',
    href: '/sales/invoices/new',
    icon: 'notebook',
    permission: 'invoice:create',
    accent: '#1D4ED8',
    wash: '#DBEAFE',
    blurb: 'Customer owes you',
  },
  {
    key: 'quotations',
    label: 'Quotations',
    href: '/sales/estimates/new',
    icon: 'book',
    permission: 'invoice:create',
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
    label: 'By customer',
    href: '/reports/sales-by-customer',
    icon: 'users',
    accent: '#0369A1',
    wash: '#E0F2FE',
    blurb: 'Who buys most',
  },
  {
    key: 'sales-by-item',
    label: 'By item',
    href: '/reports/sales-by-item',
    icon: 'package',
    accent: '#1D4ED8',
    wash: '#DBEAFE',
    blurb: 'What sells',
  },
  {
    key: 'ar-aging',
    label: 'Receivables',
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
    label: 'Payments in',
    href: '/reports/payments-received',
    icon: 'hand-coins',
    accent: '#047857',
    wash: '#D1FAE5',
    blurb: 'Cash collected',
  },
  {
    key: 'customer-balances',
    label: 'Balances',
    href: '/reports/customer-balances',
    icon: 'wallet',
    accent: '#B45309',
    wash: '#FEF3C7',
    blurb: 'Owed per customer',
  },
  {
    key: 'statements',
    label: 'Statements',
    href: '/reports/statements/customer',
    icon: 'book',
    accent: '#334155',
    wash: '#F1F5F9',
    blurb: 'One customer, one period',
  },
  {
    key: 'product-profitability',
    label: 'Margin',
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
