/**
 * The standard-report favourites. Each row opens a report that already reads
 * the ledger, or a list that is the same record under the name people look for.
 */
export type StandardReport = {
  label: string
  href: string
  group: 'favourite' | 'management' | 'performance' | 'spreadsheet'
}

export const STANDARD_FAVOURITES: StandardReport[] = [
  { label: 'Account List', href: '/reports/account-balances', group: 'favourite' },
  { label: 'Accounts receivable ageing summary', href: '/reports/ar-aging', group: 'favourite' },
  { label: 'Accounts receivable ageing detail', href: '/reports/ar-aging-detail', group: 'favourite' },
  { label: 'Accounts payable ageing detail', href: '/reports/ap-aging-detail', group: 'favourite' },
  { label: 'Balance Sheet', href: '/reports/balance-sheet', group: 'favourite' },
  { label: 'Bills and Applied Payments', href: '/reports/bills-and-payments', group: 'favourite' },
  { label: 'Bill Payment List', href: '/reports/payments-made', group: 'favourite' },
  { label: 'Collections Report', href: '/reports/collections', group: 'favourite' },
  { label: 'Business Snapshot', href: '/reports/business-overview', group: 'favourite' },
  { label: 'Sales by Customer Detail', href: '/reports/sales-by-customer-detail', group: 'favourite' },
  { label: 'Customer Balance Summary', href: '/reports/customer-balances', group: 'favourite' },
  { label: 'Customer Balance Detail', href: '/reports/statements/customer', group: 'favourite' },
  { label: 'Income by Customer Summary', href: '/reports/sales-by-customer', group: 'favourite' },
  { label: 'Sales by Customer Summary', href: '/reports/sales-by-customer', group: 'favourite' },
  { label: 'Custom Summary Report', href: '/reports/side-by-side', group: 'favourite' },
  { label: 'Invoice List', href: '/reports/invoice-list', group: 'favourite' },
  { label: 'Product/Service List', href: '/reports/product-service-list', group: 'favourite' },
  { label: 'Journal', href: '/reports/journal-report', group: 'favourite' },
  { label: 'Profit and Loss', href: '/reports/profit-loss', group: 'favourite' },
  { label: 'Profit and Loss by Customer', href: '/reports/profit-loss/by-customer', group: 'favourite' },
  { label: 'Profit and Loss by Month', href: '/reports/profit-loss/by-month', group: 'favourite' },
  { label: 'Profit and Loss Detail', href: '/reports/profit-loss/detail', group: 'favourite' },
  { label: 'Profit and Loss as % of total income', href: '/reports/profit-loss/percent', group: 'favourite' },
  { label: 'Inventory Valuation Summary', href: '/reports/inventory-valuation', group: 'favourite' },
  { label: 'Inventory Status', href: '/reports/inventory-reorder', group: 'favourite' },
  { label: 'Bill status', href: '/reports/bill-list', group: 'favourite' },
  { label: 'Estimate List', href: '/reports/estimate-list', group: 'favourite' },
  { label: 'Quotation List', href: '/reports/quotation-list', group: 'favourite' },
  { label: 'Sales Order List', href: '/reports/sales-order-list', group: 'favourite' },
  { label: 'Customer Contact List', href: '/reports/customer-contact-list', group: 'favourite' },
  { label: 'Vendor Contact List', href: '/reports/vendor-contact-list', group: 'favourite' },
  { label: 'Open Purchase Orders', href: '/reports/open-purchase-orders', group: 'favourite' },
  { label: 'Inventory by Store', href: '/reports/stock-by-store', group: 'favourite' },
  { label: 'Project Profitability', href: '/reports/project-profitability', group: 'favourite' },
  { label: 'Unapplied Customer Payments', href: '/reports/unapplied-payments', group: 'favourite' },
]

export const MANAGEMENT_REPORTS: StandardReport[] = [
  { label: 'Business overview', href: '/reports/business-overview', group: 'management' },
  { label: 'Profit and Loss', href: '/reports/profit-loss', group: 'management' },
  { label: 'Balance Sheet', href: '/reports/balance-sheet', group: 'management' },
  { label: 'Statement of Cash Flows', href: '/reports/cash-flow', group: 'management' },
  { label: 'Collections Report', href: '/reports/collections', group: 'management' },
  { label: 'A/P Aging Summary', href: '/reports/ap-aging', group: 'management' },
  { label: 'Trial Balance', href: '/reports/trial-balance', group: 'management' },
]

export const PERFORMANCE_REPORTS: StandardReport[] = [
  { label: 'Activity by User', href: '/reports/activity-by-user', group: 'performance' },
  { label: 'User Activity', href: '/reports/user-activity', group: 'performance' },
  { label: 'Product Profitability', href: '/reports/product-profitability', group: 'performance' },
  { label: 'Sales by Customer Summary', href: '/reports/sales-by-customer', group: 'performance' },
  { label: 'Expenses by Vendor Summary', href: '/reports/expenses-by-vendor', group: 'performance' },
  { label: 'Project Profitability', href: '/reports/project-profitability', group: 'performance' },
  { label: 'POS Sales', href: '/reports/pos-sales', group: 'performance' },
  { label: 'Inventory by Store', href: '/reports/stock-by-store', group: 'performance' },
]

export const SPREADSHEET_EXPORTS: { label: string; href: string }[] = [
  { label: 'Profit and Loss (CSV)', href: '/api/reports/profit-loss' },
  { label: 'Balance Sheet (CSV)', href: '/api/reports/balance-sheet' },
  { label: 'Statement of Cash Flows (CSV)', href: '/api/reports/cash-flow' },
  { label: 'Invoice List (CSV)', href: '/api/reports/invoice-list' },
  { label: 'Bill List (CSV)', href: '/api/reports/bill-list' },
  { label: 'Account List (CSV)', href: '/api/exports/accounts' },
  { label: 'Expenses (CSV)', href: '/api/exports/expenses' },
  { label: 'Purchase orders (CSV)', href: '/api/exports/purchase-orders' },
  { label: 'Estimate List (CSV)', href: '/api/reports/estimate-list' },
  { label: 'Quotation List (CSV)', href: '/api/reports/quotation-list' },
  { label: 'Customer Contact List (CSV)', href: '/api/reports/customer-contact-list' },
  { label: 'Vendor Contact List (CSV)', href: '/api/reports/vendor-contact-list' },
  { label: 'Inventory by Store (CSV)', href: '/api/reports/stock-by-store' },
  { label: 'Project Profitability (CSV)', href: '/api/reports/project-profitability' },
]

export const REPORT_CENTRE_TABS = [
  { href: '/reports', label: 'Standard reports', key: 'standard' },
  { href: '/reports/custom', label: 'Custom reports', key: 'custom' },
  { href: '/reports/management', label: 'Management reports', key: 'management' },
  { href: '/reports/spreadsheet', label: 'Spreadsheet sync', key: 'spreadsheet' },
  { href: '/reports/performance', label: 'Performance centre', key: 'performance' },
] as const
