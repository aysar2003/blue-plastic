/**
 * Optional header fields and line columns that a company form template can hide.
 * Required entry fields (party, date, number, deposit/payment when needed) stay on.
 */

export type FormFieldDef = { id: string; label: string }
export type FormColumnDef = { id: string; label: string; locked?: boolean }

/** Sales field that may only apply to certain document types. */
export type SalesFormFieldDef = FormFieldDef & {
  /** When set, the Customize list only shows this for these SalesDocumentType values. */
  forTypes?: readonly string[]
}

const INVOICE_FAMILY = [
  'INVOICE',
  'ESTIMATE',
  'QUOTATION',
  'SALES_ORDER',
  'CREDIT_MEMO',
] as const

const RECEIPT_FAMILY = ['SALES_RECEIPT', 'REFUND_RECEIPT'] as const

/** Sales header fields that may be toggled. */
export const SALES_FORM_FIELDS: SalesFormFieldDef[] = [
  { id: 'project', label: 'Project' },
  { id: 'inRef', label: 'IN/' },
  { id: 'reference', label: 'P.O. NO.' },
  { id: 'prescriptionRef', label: 'Rx / prescription' },
  { id: 'currency', label: 'Currency & FX' },
  { id: 'dueDate', label: 'Due date', forTypes: INVOICE_FAMILY },
  { id: 'paymentTerms', label: 'Terms', forTypes: ['INVOICE', 'ESTIMATE', 'QUOTATION', 'SALES_ORDER'] },
  { id: 'customerBalance', label: 'Open balance', forTypes: ['INVOICE'] },
  { id: 'paymentMethod', label: 'Payment method', forTypes: RECEIPT_FAMILY },
  { id: 'addresses', label: 'Billing & shipping' },
  { id: 'workSite', label: 'Work site' },
  { id: 'workScope', label: 'Work scope' },
  { id: 'documentDiscount', label: 'Discount' },
  { id: 'customerMessage', label: 'Message' },
  { id: 'memo', label: 'Memo' },
]

/** Sales line columns. Item + Amount stay locked so the grid is never empty. */
export const SALES_FORM_COLUMNS: FormColumnDef[] = [
  { id: 'item', label: 'Item', locked: true },
  { id: 'description', label: 'Description' },
  { id: 'qty', label: 'Qty' },
  { id: 'unit', label: 'Unit' },
  { id: 'rate', label: 'Rate' },
  { id: 'amount', label: 'Amount', locked: true },
  { id: 'store', label: 'Store' },
  { id: 'tax', label: 'Tax' },
]

/** Purchase header fields that may be toggled. */
export const PURCHASE_FORM_FIELDS: FormFieldDef[] = [
  { id: 'project', label: 'Project' },
  { id: 'inRef', label: 'IN/' },
  { id: 'reference', label: 'P.O. NO.' },
  { id: 'paymentTerms', label: 'Terms' },
]

/** Purchase item-line columns. */
export const PURCHASE_FORM_COLUMNS: FormColumnDef[] = [
  { id: 'item', label: 'Item', locked: true },
  { id: 'description', label: 'Description' },
  { id: 'qty', label: 'Qty' },
  { id: 'unit', label: 'Unit' },
  { id: 'rate', label: 'Rate' },
  { id: 'amount', label: 'Amount', locked: true },
  { id: 'store', label: 'Store' },
  { id: 'tax', label: 'Tax' },
]

/** Purchase category-line columns (no qty/rate/store). */
export const PURCHASE_CATEGORY_COLUMNS: FormColumnDef[] = [
  { id: 'category', label: 'Category', locked: true },
  { id: 'description', label: 'Description' },
  { id: 'tax', label: 'Tax' },
  { id: 'amount', label: 'Amount', locked: true },
]

/** Fields shown in Customize for one sales document type. */
export function salesFieldsForType(type: string): FormFieldDef[] {
  return SALES_FORM_FIELDS.filter((field) => !field.forTypes || field.forTypes.includes(type)).map(
    ({ id, label }) => ({ id, label }),
  )
}

export function defaultFieldVisibility(fields: FormFieldDef[]): Record<string, boolean> {
  return Object.fromEntries(fields.map((field) => [field.id, true]))
}

export function defaultColumnVisibility(columns: FormColumnDef[]): Record<string, boolean> {
  return Object.fromEntries(columns.map((column) => [column.id, true]))
}

export function isFieldVisible(fields: Record<string, boolean> | undefined, id: string): boolean {
  if (!fields || fields[id] === undefined) return true
  return fields[id] !== false
}

export function isColumnVisible(columns: Record<string, boolean> | undefined, id: string): boolean {
  if (!columns || columns[id] === undefined) return true
  return columns[id] !== false
}

/** Saved order merged with any new catalog ids (appended). */
export function resolveCatalogOrder(catalogIds: string[], saved?: string[] | null): string[] {
  const valid = new Set(catalogIds)
  const base = Array.isArray(saved) ? saved.filter((id) => valid.has(id)) : []
  return [...base, ...catalogIds.filter((id) => !base.includes(id))]
}

/** Move `fromId` to the position of `toId` within an order list. */
export function moveCatalogId(order: string[], fromId: string, toId: string): string[] {
  if (fromId === toId) return order
  const from = order.indexOf(fromId)
  const to = order.indexOf(toId)
  if (from < 0 || to < 0) return order
  const next = [...order]
  next.splice(from, 1)
  next.splice(to, 0, fromId)
  return next
}

/** Catalog rows that are visible, in template order. */
export function orderedVisibleCatalog<T extends { id: string }>(
  catalog: T[],
  visibility: Record<string, boolean> | undefined,
  order?: string[] | null,
): T[] {
  const byId = new Map(catalog.map((row) => [row.id, row]))
  const ids = resolveCatalogOrder(
    catalog.map((row) => row.id),
    order,
  )
  return ids
    .filter((id) => isColumnVisible(visibility, id))
    .map((id) => byId.get(id))
    .filter((row): row is T => Boolean(row))
}
