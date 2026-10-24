import {
  isDocumentKindEnabled,
  SALES_HUB_KIND,
  type OrgFeatureFlags,
} from '@/lib/feature-flags'
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
    key: 'estimates',
    label: 'Estimates',
    href: '/sales/estimates',
    icon: 'book',
    permission: 'invoice:read',
    accent: '#22d3ee',
    wash: '#cffafe',
    blurb: 'Estimates — create, list, convert',
  },
  {
    key: 'quotations',
    label: 'Quotations',
    href: '/sales/quotations',
    icon: 'notebook',
    permission: 'invoice:read',
    accent: '#0891b2',
    wash: '#ecfeff',
    blurb: 'Quotations — create, list, convert',
  },
  {
    key: 'sales-orders',
    label: 'Sales orders',
    href: '/sales/sales-orders',
    icon: 'clipboard',
    permission: 'invoice:read',
    accent: '#C2410C',
    wash: '#FFEDD5',
    blurb: 'Order now — invoice or receipt when collected',
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
    key: 'delivery',
    label: 'Delivery',
    href: '/sales/delivery',
    icon: 'package',
    permission: 'invoice:read',
    accent: '#0369A1',
    wash: '#E0F2FE',
    blurb: 'Dispatch notes & tickets',
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
    key: 'ar-aging-detail',
    label: 'A/R Aging Detail',
    href: '/reports/ar-aging-detail',
    icon: 'notebook',
    accent: '#BE123C',
    wash: '#FFE4E6',
    blurb: 'Each open invoice by age',
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
  {
    key: 'invoice-list',
    label: 'Invoice List',
    href: '/reports/invoice-list',
    icon: 'file',
    accent: '#0369A1',
    wash: '#E0F2FE',
    blurb: 'Every invoice',
  },
  {
    key: 'estimate-list',
    label: 'Estimate List',
    href: '/reports/estimate-list',
    icon: 'book',
    accent: '#22d3ee',
    wash: '#cffafe',
    blurb: 'Every estimate',
  },
  {
    key: 'quotation-list',
    label: 'Quotation List',
    href: '/reports/quotation-list',
    icon: 'notebook',
    accent: '#0891b2',
    wash: '#ecfeff',
    blurb: 'Every quotation',
  },
  {
    key: 'sales-order-list',
    label: 'Sales Order List',
    href: '/reports/sales-order-list',
    icon: 'clipboard',
    accent: '#C2410C',
    wash: '#FFEDD5',
    blurb: 'Every sales order',
  },
  {
    key: 'sales-receipt-list',
    label: 'Sales Receipt List',
    href: '/reports/sales-receipt-list',
    icon: 'receipt',
    accent: '#0F766E',
    wash: '#CCFBF1',
    blurb: 'Paid on the spot',
  },
  {
    key: 'credit-memo-list',
    label: 'Credit Memo List',
    href: '/reports/credit-memo-list',
    icon: 'banknote',
    accent: '#BE123C',
    wash: '#FFE4E6',
    blurb: 'Credits issued',
  },
  {
    key: 'sales-by-customer-detail',
    label: 'Sales by Customer Detail',
    href: '/reports/sales-by-customer-detail',
    icon: 'book',
    accent: '#334155',
    wash: '#F1F5F9',
    blurb: 'Each sale',
  },
  {
    key: 'sales-by-customer-item',
    label: 'Sales by Customer (Item Detail)',
    href: '/reports/sales-by-customer-item',
    icon: 'package',
    accent: '#0369A1',
    wash: '#E0F2FE',
    blurb: 'Items each customer bought',
  },
  {
    key: 'open-sales-orders',
    label: 'Open Sales Orders by Customer',
    href: '/reports/open-sales-orders',
    icon: 'clipboard',
    accent: '#C2410C',
    wash: '#FFEDD5',
    blurb: 'Orders still outstanding',
  },
  {
    key: 'open-estimates',
    label: 'Open Estimates by Customer',
    href: '/reports/open-estimates',
    icon: 'file',
    accent: '#22d3ee',
    wash: '#cffafe',
    blurb: 'Estimates not yet sold',
  },
  {
    key: 'sales-by-item-detail',
    label: 'Sales by Product/Service Detail',
    href: '/reports/sales-by-item-detail',
    icon: 'package',
    accent: '#1E3A5F',
    wash: '#E2E8F0',
    blurb: 'Each sold line',
  },
  {
    key: 'sales-by-sales-person',
    label: 'Sales by Sales Person',
    href: '/reports/sales-by-sales-person',
    icon: 'users',
    accent: '#B45309',
    wash: '#FEF3C7',
    blurb: 'Who looks after the sale',
  },
  {
    key: 'transaction-list-by-customer',
    label: 'Transaction List by Customer',
    href: '/reports/transaction-list-by-customer',
    icon: 'scroll',
    accent: '#334155',
    wash: '#F1F5F9',
    blurb: 'Sales and payments',
  },
  {
    key: 'invoices-and-payments',
    label: 'Invoices and Applied Payments',
    href: '/reports/invoices-and-payments',
    icon: 'notebook',
    accent: '#0369A1',
    wash: '#E0F2FE',
    blurb: 'What settled which invoice',
  },
  {
    key: 'refund-list',
    label: 'Refund Receipt List',
    href: '/reports/refund-list',
    icon: 'banknote',
    accent: '#BE123C',
    wash: '#FFE4E6',
    blurb: 'Cash returned',
  },
  {
    key: 'customer-contact-list',
    label: 'Customer Contact List',
    href: '/reports/customer-contact-list',
    icon: 'users',
    accent: '#B45309',
    wash: '#FEF3C7',
    blurb: 'Names and numbers',
  },
  {
    key: 'unapplied-payments',
    label: 'Unapplied Payments',
    href: '/reports/unapplied-payments',
    icon: 'wallet',
    accent: '#047857',
    wash: '#D1FAE5',
    blurb: 'On account',
  },
  {
    key: 'collections',
    label: 'Collections Report',
    href: '/reports/collections',
    icon: 'hand-coins',
    accent: '#BE123C',
    wash: '#FFE4E6',
    blurb: 'Past due',
  },
  {
    key: 'sales-delivery',
    label: 'Sales Delivery',
    href: '/reports/sales-delivery',
    icon: 'package',
    accent: '#0369A1',
    wash: '#E0F2FE',
    blurb: 'Notes shipped in the period',
  },
]

export function salesAppsForPermissions(
  permissions: ReadonlySet<string> | Iterable<string>,
  features?: OrgFeatureFlags,
): SalesHubApp[] {
  const allowed = permissions instanceof Set ? permissions : new Set(permissions)
  return SALES_HUB_APPS.filter((app) => {
    if (app.permission && !allowed.has(app.permission)) return false
    if (features) {
      const kind = SALES_HUB_KIND[app.key]
      if (kind && !isDocumentKindEnabled(features, 'sales', kind)) return false
    }
    return true
  })
}
