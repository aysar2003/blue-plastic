/**
 * How a deletion is shown in Trash.
 *
 * The log names the record the way a person knows it — an invoice number, a
 * customer name — and nothing else. The Trash detail screen holds restore and
 * PDF; this presenter stays display-only. Origin (where it lived in the books)
 * is resolved separately so list rows stay free of live links.
 */

import { PURCHASE_TYPES } from '@/lib/purchase-types'
import { SALES_TYPES } from '@/lib/sales-types'

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

/** Delete reasons are free text — never drop them as if they were row ids. */
function reasonText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function reasonOf(after: unknown): string | null {
  const record = recordOf(after)
  if (!record) return null
  return reasonText(record.reason) ?? reasonText(record.deleteReason)
}

/**
 * Restored or cleared DELETE rows leave Trash.
 *
 * Do not express this with Prisma `NOT: { after: { path, equals: true } }` —
 * in PostgreSQL that becomes `NOT (json->>'x' = 'true')`, and a missing key
 * yields NULL, so every ordinary delete is dropped from the list.
 */
export function isHiddenFromTrash(after: unknown): boolean {
  const record = recordOf(after)
  if (!record) return false
  return record.restored === true || record.cleared === true
}

/** Entity kinds that Trash can put back into the working books. */
export const TRASH_RESTORABLE = new Set([
  'Journal',
  'SalesDocument',
  'PurchaseDocument',
  'CustomerPayment',
  'BillPayment',
  'BankTransfer',
  'InventoryAdjustment',
  'AssemblyBuild',
])

/** Whether a Trash row may offer Restore, and why not when it cannot. */
export function trashRestoreCapability(entity: string): {
  canRestore: boolean
  cannotRestoreReason: string | null
} {
  if (entity === 'Deposit') {
    return {
      canRestore: false,
      cannotRestoreReason:
        'Deposits cannot be restored — the payments they banked were released.',
    }
  }
  if (!TRASH_RESTORABLE.has(entity)) {
    return {
      canRestore: false,
      cannotRestoreReason: 'This kind of record cannot be restored from Trash.',
    }
  }
  return { canRestore: true, cannotRestoreReason: null }
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

/** Where the deleted record lived in the working books (list, not the dead row). */
export type TrashOrigin = {
  label: string
  href: string
}

const ENTITY_ORIGIN: Record<string, TrashOrigin> = {
  Journal: { label: 'Accounting · Journals', href: '/journals' },
  CustomerPayment: { label: 'Payments · All payments', href: '/payments' },
  BillPayment: { label: 'Bill payments', href: '/bill-payments' },
  BankTransfer: { label: 'Banking', href: '/banking' },
  Deposit: { label: 'Banking', href: '/banking' },
  InventoryAdjustment: { label: 'Inventory · Adjust stock', href: '/inventory/adjustments/new' },
  AssemblyBuild: { label: 'Inventory · Build assemblies', href: '/inventory/builds/new' },
  Customer: { label: 'Customers', href: '/customers' },
  Vendor: { label: 'Vendors', href: '/vendors' },
  Item: { label: 'Inventory · Products', href: '/items' },
  LedgerAccount: { label: 'Accounting · Chart of accounts', href: '/accounts' },
  Membership: { label: 'Settings · Company users', href: '/settings/users' },
}

export function trashOrigin(entity: string, before: unknown): TrashOrigin | null {
  const record = recordOf(before)
  const type = text(record?.type)

  if (entity === 'SalesDocument' && type) {
    const cfg = SALES_TYPES.find((entry) => entry.type === type)
    if (cfg) return { label: `Sales · ${cfg.plural}`, href: `/sales/${cfg.slug}` }
  }
  if (entity === 'PurchaseDocument' && type) {
    const cfg = PURCHASE_TYPES.find((entry) => entry.type === type)
    if (cfg) return { label: `Purchases · ${cfg.plural}`, href: `/purchases/${cfg.slug}` }
  }

  return ENTITY_ORIGIN[entity] ?? null
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
