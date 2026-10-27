/**
 * Company user history — sign-in, sign-out, and the work each person recorded.
 * The Settings screen shows the last year; older sign-in rows are pruned.
 */

export const USER_HISTORY_RETENTION_DAYS = 365

export const USER_HISTORY_ACTIONS = [
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
  'ARCHIVE',
  'POST',
  'REVERSE',
  'CLOSE_PERIOD',
  'REOPEN_PERIOD',
  'SUBMIT',
  'APPROVE',
  'REJECT',
] as const

export type UserHistoryAction = (typeof USER_HISTORY_ACTIONS)[number]

export const USER_HISTORY_ACTION_LABEL: Record<string, string> = {
  CREATE: 'Entered',
  UPDATE: 'Changed',
  DELETE: 'Deleted',
  ARCHIVE: 'Archived',
  RESTORE: 'Restored',
  LOGIN: 'Signed in',
  LOGIN_FAILED: 'Sign-in failed',
  LOGOUT: 'Signed out',
  POST: 'Posted',
  REVERSE: 'Reversed',
  CLOSE_PERIOD: 'Closed the period',
  REOPEN_PERIOD: 'Reopened the period',
  SUBMIT: 'Submitted',
  APPROVE: 'Approved',
  REJECT: 'Rejected',
}

export const USER_HISTORY_ENTITY_LABEL: Record<string, string> = {
  User: 'Login',
  SalesDocument: 'Sale',
  PurchaseDocument: 'Purchase',
  Journal: 'Journal',
  Customer: 'Customer',
  Vendor: 'Vendor',
  CustomerPayment: 'Customer payment',
  BillPayment: 'Bill payment',
  Item: 'Item',
  LedgerAccount: 'Account',
  BankTransfer: 'Transfer',
  Deposit: 'Deposit',
  InventoryAdjustment: 'Stock adjustment',
  Membership: 'Company user',
}

const SALES_SLUG: Record<string, string> = {
  INVOICE: 'invoices',
  ESTIMATE: 'estimates',
  QUOTATION: 'quotations',
  SALES_ORDER: 'sales-orders',
  SALES_RECEIPT: 'sales-receipts',
  CREDIT_MEMO: 'credit-memos',
  REFUND_RECEIPT: 'refunds',
}

const PURCHASE_SLUG: Record<string, string> = {
  BILL: 'bills',
  EXPENSE: 'expenses',
  VENDOR_CREDIT: 'vendor-credits',
  PURCHASE_ORDER: 'purchase-orders',
  PURCHASE_REQUEST: 'purchase-requests',
  RFQ: 'rfqs',
}

function recordOf(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function userHistoryDetail(after: unknown, before: unknown): string | null {
  for (const source of [after, before]) {
    const record = recordOf(source)
    if (!record) continue
    for (const key of ['number', 'displayName', 'name', 'memo', 'email', 'sku']) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  return null
}

function payloadType(after: unknown, before: unknown): string {
  for (const source of [after, before]) {
    const type = recordOf(source)?.type
    if (typeof type === 'string' && type.trim()) return type.trim()
  }
  return ''
}

/** Open the live record when it still exists; deleted rows stay in Trash. */
export function userHistoryHref(
  action: string,
  entity: string,
  entityId: string,
  after: unknown,
  before?: unknown,
): string | null {
  if (action === 'DELETE' || action === 'LOGIN' || action === 'LOGIN_FAILED' || action === 'LOGOUT') {
    return null
  }
  const type = payloadType(after, before)
  if (entity === 'Journal') return `/journals/${entityId}`
  if (entity === 'SalesDocument' && SALES_SLUG[type]) return `/sales/${SALES_SLUG[type]}/${entityId}`
  if (entity === 'PurchaseDocument' && PURCHASE_SLUG[type]) {
    return `/purchases/${PURCHASE_SLUG[type]}/${entityId}`
  }
  if (entity === 'Customer') return `/customers?id=${entityId}`
  if (entity === 'Vendor') return `/vendors/${entityId}`
  if (entity === 'CustomerPayment') return '/payments'
  if (entity === 'BillPayment') return '/bill-payments'
  if (entity === 'Item') return `/items/${entityId}`
  if (entity === 'LedgerAccount') return `/accounts/${entityId}`
  if (entity === 'BankTransfer') return '/banking'
  if (entity === 'InventoryAdjustment') return '/inventory/adjustments/new'
  if (entity === 'AssemblyBuild') return '/inventory/builds/new'
  return null
}

export function userHistoryRetentionStart(now = new Date()): Date {
  const start = new Date(now)
  start.setUTCDate(start.getUTCDate() - USER_HISTORY_RETENTION_DAYS)
  return start
}

export function actionLabel(action: string): string {
  return USER_HISTORY_ACTION_LABEL[action] ?? action
}

export function entityLabel(entity: string): string {
  return USER_HISTORY_ENTITY_LABEL[entity] ?? entity.replace(/([a-z])([A-Z])/g, '$1 $2')
}
