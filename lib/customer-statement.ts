import { toCalendarDate, type CalendarDate } from '@/lib/date'
import { Decimal } from '@/lib/money'

export type StatementKind =
  | 'INVOICE'
  | 'CREDIT_MEMO'
  | 'PAYMENT'
  | 'SALES_RECEIPT'
  | 'REFUND_RECEIPT'
  | 'JOURNAL'
  | 'ESTIMATE'

export type FilterableEntry = {
  kind: StatementKind
  openAmount: Decimal
  dueDate: Date | null
}

/**
 * How a customer statement is asked for.
 *
 * The view is the paper, and the three customer papers stay separate:
 * "invoice by invoice" prints each invoice whole, one page each; "invoice
 * summary" is only the list of those invoices; "statement" writes every line
 * out. The type and the status narrow which rows are on that paper. The amount
 * due stays the full balance either way.
 */
export const STATEMENT_VIEWS = ['invoices', 'summary', 'detail', 'regular', 'arrow'] as const
export const STATEMENT_TOTALS = ['line', 'cards', 'band', 'stack'] as const
export const STATEMENT_TYPES = [
  'all',
  'invoice',
  'payment',
  'credit',
  'receipt',
  'refund',
  'journal',
  'estimate',
] as const
export const STATEMENT_STATUSES = ['all', 'open', 'overdue', 'paid'] as const

export type StatementView = (typeof STATEMENT_VIEWS)[number]
export type StatementType = (typeof STATEMENT_TYPES)[number]
export type StatementStatus = (typeof STATEMENT_STATUSES)[number]
export type StatementTotals = (typeof STATEMENT_TOTALS)[number]

export type StatementFilter = {
  view: StatementView
  type: StatementType
  status: StatementStatus
  totals: StatementTotals
}

export const STATEMENT_VIEW_LABELS: Record<StatementView, string> = {
  invoices: 'Invoice by invoice',
  summary: 'Invoice summary',
  detail: 'Statement',
  regular: 'Grouped — one row',
  arrow: 'Open one by one',
}

export const STATEMENT_TOTALS_LABELS: Record<StatementTotals, string> = {
  line: 'Last row',
  cards: 'Four cards',
  band: 'Total band',
  stack: 'Stacked',
}

export const STATEMENT_TYPE_LABELS: Record<StatementType, string> = {
  all: 'All types',
  invoice: 'Invoice',
  payment: 'Payment',
  credit: 'Credit memo',
  receipt: 'Sales receipt',
  refund: 'Refund',
  journal: 'Journal',
  estimate: 'Estimate',
}

export const STATEMENT_STATUS_LABELS: Record<StatementStatus, string> = {
  all: 'All',
  open: 'Open',
  overdue: 'Overdue',
  paid: 'Paid',
}

const TYPE_KIND: Record<Exclude<StatementType, 'all'>, StatementKind> = {
  invoice: 'INVOICE',
  payment: 'PAYMENT',
  credit: 'CREDIT_MEMO',
  receipt: 'SALES_RECEIPT',
  refund: 'REFUND_RECEIPT',
  journal: 'JOURNAL',
  estimate: 'ESTIMATE',
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export function readStatementFilter(
  query: Record<string, string | string[] | undefined>,
): StatementFilter {
  const view = one(query.view)
  const type = one(query.type)
  const status = one(query.status)
  const totals = one(query.totals)
  return {
    view: (STATEMENT_VIEWS as readonly string[]).includes(view ?? '') ? (view as StatementView) : 'detail',
    type: (STATEMENT_TYPES as readonly string[]).includes(type ?? '')
      ? (type as StatementType)
      : 'all',
    status: (STATEMENT_STATUSES as readonly string[]).includes(status ?? '')
      ? (status as StatementStatus)
      : 'all',
    totals: (STATEMENT_TOTALS as readonly string[]).includes(totals ?? '')
      ? (totals as StatementTotals)
      : 'line',
  }
}

export function statementIsFiltered(filter: StatementFilter): boolean {
  return filter.type !== 'all' || filter.status !== 'all'
}

const TYPE_PLURAL: Record<Exclude<StatementType, 'all'>, string> = {
  invoice: 'invoices',
  payment: 'payments',
  credit: 'credit memos',
  receipt: 'sales receipts',
  refund: 'refunds',
  journal: 'journals',
  estimate: 'estimates',
}

/** A sentence for the paper, empty when every row is shown. */
export function statementFilterCaption(filter: StatementFilter): string {
  if (!statementIsFiltered(filter)) return ''
  const type = filter.type === 'all' ? 'transactions' : TYPE_PLURAL[filter.type]
  const lead = filter.status === 'all' ? type : `${STATEMENT_STATUS_LABELS[filter.status].toLowerCase()} ${type}`
  return `Showing ${lead}. Amount due is still the full balance for these dates.`
}

const OPEN = '0.005'

function isOpen(amount: Decimal): boolean {
  return amount.greaterThan(OPEN)
}

/**
 * Whether this row belongs on the statement the user asked for.
 *
 * "All types" is the statement of what they owe, so estimates stay off it
 * until somebody asks for estimates. A type and a status both have to match.
 */
export function entryVisible(entry: FilterableEntry, filter: StatementFilter, asOf: CalendarDate): boolean {
  if (filter.type === 'all' ? entry.kind === 'ESTIMATE' : entry.kind !== TYPE_KIND[filter.type]) {
    return false
  }

  if (filter.status === 'all') return true

  if (filter.status === 'overdue') {
    return (
      entry.kind === 'INVOICE' &&
      isOpen(entry.openAmount) &&
      entry.dueDate !== null &&
      toCalendarDate(entry.dueDate) < asOf
    )
  }

  if (filter.status === 'open') {
    if (entry.kind === 'JOURNAL') return true
    if (entry.kind === 'INVOICE' || entry.kind === 'CREDIT_MEMO' || entry.kind === 'PAYMENT') {
      return isOpen(entry.openAmount)
    }
    return false
  }

  // Paid: settled documents, and every receipt of money.
  if (entry.kind === 'JOURNAL' || entry.kind === 'ESTIMATE') return false
  if (entry.kind === 'PAYMENT' || entry.kind === 'SALES_RECEIPT' || entry.kind === 'REFUND_RECEIPT') {
    return true
  }
  return !isOpen(entry.openAmount)
}

export function visibleEntries<T extends FilterableEntry>(
  entries: T[],
  filter: StatementFilter,
  asOf: CalendarDate,
): T[] {
  return entries.filter((entry) => entryVisible(entry, filter, asOf))
}

/**
 * The invoices an "invoice by invoice" statement prints: every invoice in the
 * period, in statement (date) order, still narrowed by the balance filter so
 * "open" or "overdue" prints only what is owed. The type menu does not apply —
 * the paper is invoices by definition.
 */
export function statementInvoices<T extends FilterableEntry>(
  entries: T[],
  filter: StatementFilter,
  asOf: CalendarDate,
): T[] {
  return visibleEntries(entries, { ...filter, type: 'invoice' }, asOf)
}
