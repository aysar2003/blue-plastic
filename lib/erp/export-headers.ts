/**
 * Human labels for staff CSV/Excel downloads (modern ERP style).
 * Technical field names stay on types; files never ship camelCase headers.
 */

export const SHAREHOLDER_REGISTER_HEADERS = [
  'Name',
  'Shares',
  'Ownership %',
  'Capital account',
] as const

export const EQUITY_MOVEMENT_HEADERS = [
  'Date',
  'Kind',
  'Shareholder',
  'Amount',
  'Memo',
  'Equity account',
] as const

export const PORTFOLIO_HEADERS = [
  'Organisation Id',
  'Name',
  'Ownership %',
  'Rolled net income',
  'NCI',
] as const

export const ROYALTY_HEADERS = [
  'Franchisee',
  'Royalty %',
  'Sales',
  'Royalty due',
] as const

export const HOURS_HEADERS = ['Date', 'Employee', 'Kind', 'Hours', 'Note'] as const

export const WHT_REMITTANCE_HEADERS = [
  'Bill number',
  'Bill date',
  'Vendor',
  'Base amount',
  'Withhold %',
  'Withhold amount',
  'Currency',
] as const

export const CONTROLLED_MOVEMENT_HEADERS = [
  'Date',
  'Item',
  'SKU',
  'Lot number',
  'Type',
  'Quantity',
  'Journal number',
] as const

export const CLAIMS_HEADERS = [
  'Visit Id',
  'Patient',
  'Opened',
  'Closed',
  'Payer',
  'Payer ref',
  'Department',
  'Invoice number',
  'Export batch Id',
  'Claims exported at',
  'Claim status',
  'Bill code',
  'Description',
  'Quantity',
  'Unit price',
  'Amount',
] as const

export const PATRONAGE_HEADERS = ['Shareholder Id', 'Name', 'Weight', 'Allocation'] as const

export const SETUP_HEALTH_GAP_HEADERS_HUMAN = [
  'Kind',
  'Name',
  'SKU',
  'Id',
  'Detail',
] as const
