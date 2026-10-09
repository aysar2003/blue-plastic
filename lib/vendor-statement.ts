import { toCalendarDate, type CalendarDate } from '@/lib/date'
import { STATEMENT_TOTALS, STATEMENT_VIEWS, type StatementTotals, type StatementView } from '@/lib/customer-statement'
import { Decimal } from '@/lib/money'

export type VendorStatementKind = 'BILL' | 'VENDOR_CREDIT' | 'PAYMENT' | 'EXPENSE' | 'JOURNAL' | 'PURCHASE_ORDER'

/**
 * The vendor statement asks the same three questions as the customer one:
 * which paper, which documents, and whether they are still open.
 * Purchase orders stay off the full statement until that type is chosen,
 * the same way estimates stay off a customer statement.
 */
export const VENDOR_STATEMENT_TYPES = ['all', 'bill', 'payment', 'credit', 'expense', 'journal', 'order'] as const
export const VENDOR_STATEMENT_STATUSES = ['all', 'open', 'overdue', 'paid'] as const

export type VendorStatementType = (typeof VENDOR_STATEMENT_TYPES)[number]
export type VendorStatementStatus = (typeof VENDOR_STATEMENT_STATUSES)[number]

export type VendorStatementFilter = {
  view: StatementView
  type: VendorStatementType
  status: VendorStatementStatus
  totals: StatementTotals
}

const TYPE_KIND: Record<Exclude<VendorStatementType, 'all'>, VendorStatementKind> = {
  bill: 'BILL',
  payment: 'PAYMENT',
  credit: 'VENDOR_CREDIT',
  expense: 'EXPENSE',
  journal: 'JOURNAL',
  order: 'PURCHASE_ORDER',
}

const TYPE_LABELS: Record<VendorStatementType, string> = {
  all: 'All types',
  bill: 'Bill',
  payment: 'Bill payment',
  credit: 'Vendor credit',
  expense: 'Expense',
  journal: 'Journal',
  order: 'Purchase order',
}

const TYPE_PLURAL: Record<Exclude<VendorStatementType, 'all'>, string> = {
  bill: 'bills',
  payment: 'bill payments',
  credit: 'vendor credits',
  expense: 'expenses',
  journal: 'journals',
  order: 'purchase orders',
}

const STATUS_LABELS: Record<VendorStatementStatus, string> = {
  all: 'All',
  open: 'Open',
  overdue: 'Overdue',
  paid: 'Paid',
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export function readVendorFilter(query: Record<string, string | string[] | undefined>): VendorStatementFilter {
  const view = one(query.view)
  const type = one(query.type)
  const status = one(query.status)
  const totals = one(query.totals)
  return {
    view: (STATEMENT_VIEWS as readonly string[]).includes(view ?? '') ? (view as StatementView) : 'regular',
    type: (VENDOR_STATEMENT_TYPES as readonly string[]).includes(type ?? '') ? (type as VendorStatementType) : 'all',
    status: (VENDOR_STATEMENT_STATUSES as readonly string[]).includes(status ?? '')
      ? (status as VendorStatementStatus)
      : 'all',
    totals: (STATEMENT_TOTALS as readonly string[]).includes(totals ?? '') ? (totals as StatementTotals) : 'line',
  }
}

export function vendorTypeOptions(): { value: string; label: string }[] {
  return VENDOR_STATEMENT_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }))
}

export function vendorFilterCaption(filter: VendorStatementFilter): string {
  if (filter.type === 'all' && filter.status === 'all') return ''
  const type = filter.type === 'all' ? 'transactions' : TYPE_PLURAL[filter.type]
  const lead = filter.status === 'all' ? type : `${STATUS_LABELS[filter.status].toLowerCase()} ${type}`
  return `Showing ${lead}. Amount due is still the full balance for these dates.`
}

const OPEN = '0.005'

function isOpen(amount: Decimal): boolean {
  return amount.abs().greaterThan(OPEN)
}

export function vendorEntryVisible(
  entry: { kind: VendorStatementKind; openAmount: Decimal; dueDate: Date | null },
  filter: VendorStatementFilter,
  asOf: CalendarDate,
): boolean {
  if (filter.type === 'all' ? entry.kind === 'PURCHASE_ORDER' : entry.kind !== TYPE_KIND[filter.type]) {
    return false
  }
  if (filter.status === 'all') return true
  if (filter.status === 'overdue') {
    return (
      entry.kind === 'BILL' &&
      entry.openAmount.greaterThan(OPEN) &&
      entry.dueDate !== null &&
      toCalendarDate(entry.dueDate) < asOf
    )
  }
  if (filter.status === 'open') {
    if (entry.kind === 'JOURNAL') return true
    if (entry.kind === 'BILL' || entry.kind === 'VENDOR_CREDIT' || entry.kind === 'PAYMENT') {
      return isOpen(entry.openAmount)
    }
    return false
  }
  if (entry.kind === 'JOURNAL' || entry.kind === 'PURCHASE_ORDER') return false
  if (entry.kind === 'PAYMENT' || entry.kind === 'EXPENSE') return true
  return !entry.openAmount.greaterThan(OPEN)
}

/**
 * The bills a vendor "invoice by invoice" paper prints: every bill in the
 * period, in statement order, still narrowed by the balance filter. The type
 * menu does not apply — the paper is bills, drawn in the invoice sheet style.
 */
export function statementBills<
  T extends { kind: VendorStatementKind; openAmount: Decimal; dueDate: Date | null },
>(
  entries: T[],
  filter: VendorStatementFilter,
  asOf: CalendarDate,
): T[] {
  return visibleVendorEntries(entries, { ...filter, type: 'bill' }, asOf)
}

export function visibleVendorEntries<
  T extends { kind: VendorStatementKind; openAmount: Decimal; dueDate: Date | null },
>(
  entries: T[],
  filter: VendorStatementFilter,
  asOf: CalendarDate,
): T[] {
  return entries.filter((entry) => vendorEntryVisible(entry, filter, asOf))
}
