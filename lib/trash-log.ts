/**
 * How a deletion is shown in Trash.
 *
 * The log names the record the way a person knows it — an invoice number, a
 * customer name — and nothing else. The Trash detail screen holds restore and
 * PDF; this presenter stays display-only.
 */

const KIND: Record<string, string> = {
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
  StoreTransfer: 'Store transfer',
  SalesApplication: 'Payment application',
  Membership: 'User',
}

const DOCUMENT_KIND: Record<string, string> = {
  INVOICE: 'Invoice',
  ESTIMATE: 'Estimate',
  QUOTATION: 'Quotation',
  SALES_ORDER: 'Sales order',
  SALES_RECEIPT: 'Sales receipt',
  CREDIT_MEMO: 'Credit memo',
  REFUND_RECEIPT: 'Refund receipt',
  BILL: 'Bill',
  EXPENSE: 'Expense',
  VENDOR_CREDIT: 'Vendor credit',
  PURCHASE_ORDER: 'Purchase order',
  PURCHASE_RECEIPT: 'Purchase receipt',
}

function recordOf(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/** A display string. Database ids are not names, so they are dropped. */
function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^c[a-z0-9]{20,}$/i.test(trimmed)) return null
  return trimmed
}

function kindOf(entity: string, before: Record<string, unknown> | null): string {
  const type = text(before?.type)
  if (type && DOCUMENT_KIND[type]) return DOCUMENT_KIND[type]
  return KIND[entity] ?? entity.replace(/([a-z])([A-Z])/g, '$1 $2')
}

function nameOf(before: Record<string, unknown> | null): string | null {
  if (!before) return null

  const number = text(before.number)
  if (number) return number

  const displayName = text(before.displayName)
  if (displayName) return displayName

  const name = text(before.name)
  const sku = text(before.sku)
  if (name && sku) return `${name} (${sku})`
  if (name) return name

  const email = text(before.email)
  if (email) return email

  if (Array.isArray(before.entries)) {
    const entries = before.entries.map(text).filter((entry): entry is string => Boolean(entry))
    if (entries.length > 0) return entries.join(', ')
  }

  return text(before.memo)
}

function reasonOf(after: unknown): string | null {
  const record = recordOf(after)
  if (!record) return null
  return text(record.reason) ?? text(record.deleteReason)
}

export type TrashEntry = {
  id: string
  at: Date
  who: string
  email: string | null
  kind: string
  name: string | null
  reason: string | null
}

export function presentTrashEntry(row: {
  id: string
  entity: string
  at: Date
  before: unknown
  after: unknown
  actor: { name: string; email: string } | null
}): TrashEntry {
  const before = recordOf(row.before)
  return {
    id: row.id,
    at: row.at,
    who: row.actor?.name ?? 'System',
    email: row.actor?.email ?? null,
    kind: kindOf(row.entity, before),
    name: nameOf(before),
    reason: reasonOf(row.after),
  }
}
