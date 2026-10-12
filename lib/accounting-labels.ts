import type { AccountSubtype, AccountType, JournalSourceType, PeriodStatus } from '@prisma/client'

/**
 * Presentation names for the ledger enums. Isomorphic, like `lib/roles.ts` —
 * forms and tables need them on the client, and the layering rule keeps them out
 * of `server/`.
 */
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
  REVENUE: 'Income',
  COGS: 'Cost of goods sold',
  EXPENSE: 'Expenses',
}

/** Statement order — how every balance sheet and chart of accounts is read. */
export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'COGS',
  'EXPENSE',
]

export const ACCOUNT_SUBTYPE_LABELS: Record<AccountSubtype, string> = {
  BANK: 'Bank',
  ACCOUNTS_RECEIVABLE: 'Accounts receivable',
  UNDEPOSITED_FUNDS: 'Undeposited funds',
  INVENTORY: 'Inventory',
  OTHER_CURRENT_ASSET: 'Other current asset',
  FIXED_ASSET: 'Fixed asset',
  ACCUMULATED_DEPRECIATION: 'Accumulated depreciation',
  OTHER_ASSET: 'Other asset',
  ACCOUNTS_PAYABLE: 'Accounts payable',
  CREDIT_CARD: 'Credit card',
  SALES_TAX_PAYABLE: 'Sales tax payable',
  OTHER_CURRENT_LIABILITY: 'Other current liability',
  LONG_TERM_LIABILITY: 'Long-term liability',
  OWNERS_EQUITY: "Owner's equity",
  RETAINED_EARNINGS: 'Retained earnings',
  OPENING_BALANCE_EQUITY: 'Opening balance equity',
  DRAWINGS: 'Drawings',
  INCOME: 'Income',
  OTHER_INCOME: 'Other income',
  SALES_DISCOUNTS: 'Sales discounts',
  COST_OF_GOODS_SOLD: 'Cost of goods sold',
  OPERATING_EXPENSE: 'Operating expense',
  OTHER_EXPENSE: 'Other expense',
  DEPRECIATION: 'Depreciation',
}

/** Which subtypes belong to each statement type. Mirrors the database trigger. */
export const SUBTYPES_BY_TYPE: Record<AccountType, AccountSubtype[]> = {
  ASSET: [
    'BANK',
    'ACCOUNTS_RECEIVABLE',
    'UNDEPOSITED_FUNDS',
    'INVENTORY',
    'OTHER_CURRENT_ASSET',
    'FIXED_ASSET',
    'ACCUMULATED_DEPRECIATION',
    'OTHER_ASSET',
  ],
  LIABILITY: [
    'ACCOUNTS_PAYABLE',
    'CREDIT_CARD',
    'SALES_TAX_PAYABLE',
    'OTHER_CURRENT_LIABILITY',
    'LONG_TERM_LIABILITY',
  ],
  EQUITY: ['OWNERS_EQUITY', 'RETAINED_EARNINGS', 'OPENING_BALANCE_EQUITY', 'DRAWINGS'],
  REVENUE: ['INCOME', 'OTHER_INCOME', 'SALES_DISCOUNTS'],
  COGS: ['COST_OF_GOODS_SOLD'],
  EXPENSE: ['OPERATING_EXPENSE', 'OTHER_EXPENSE', 'DEPRECIATION'],
}

/** Detail-type order inside Assets / Liabilities / … — Bank together, then AR, … */
export const ACCOUNT_SUBTYPE_ORDER: AccountSubtype[] = ACCOUNT_TYPE_ORDER.flatMap(
  (type) => SUBTYPES_BY_TYPE[type],
)

export const JOURNAL_SOURCE_LABELS: Record<JournalSourceType, string> = {
  MANUAL: 'Manual journal',
  OPENING_BALANCE: 'Opening balance',
  CLOSING_ENTRY: 'Year-end close',
  REVERSAL: 'Reversal',
  INVOICE: 'Invoice',
  SALES_RECEIPT: 'Sales receipt',
  CUSTOMER_PAYMENT: 'Customer payment',
  CREDIT_MEMO: 'Credit memo',
  REFUND_RECEIPT: 'Refund',
  BILL: 'Bill',
  BILL_PAYMENT: 'Bill payment',
  EXPENSE: 'Expense',
  VENDOR_CREDIT: 'Vendor credit',
  TRANSFER: 'Transfer',
  DEPOSIT: 'Deposit',
  INVENTORY_ADJUSTMENT: 'Inventory adjustment',
  POS_CASH_MOVE: 'POS cash in/out',
  POS_SESSION_CLOSE: 'POS session close',
}

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = {
  OPEN: 'Open',
  CLOSED: 'Closed',
  LOCKED: 'Locked',
}

/** Accounts of these types are naturally debits; the rest are naturally credits. */
export const isDebitNormalType = (type: AccountType): boolean =>
  type === 'ASSET' || type === 'COGS' || type === 'EXPENSE'

/** Income, cost of goods sold, and expenses — the accounts a profit and loss closes. */
export const isProfitAndLossType = (type: AccountType): boolean =>
  type === 'REVENUE' || type === 'COGS' || type === 'EXPENSE'
