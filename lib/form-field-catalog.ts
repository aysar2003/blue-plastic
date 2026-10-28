/**
 * Optional header fields and line columns that a company form template can hide.
 * Required entry fields (party, date, number, deposit/payment when needed) stay on.
 */

export type FormFieldDef = { id: string; label: string }
export type FormColumnDef = { id: string; label: string; locked?: boolean }

/** Sales header fields that may be toggled. */
export const SALES_FORM_FIELDS: FormFieldDef[] = [
  { id: 'project', label: 'Project' },
  { id: 'reference', label: 'PO' },
  { id: 'dueDate', label: 'Due date' },
  { id: 'paymentTerms', label: 'Terms' },
  { id: 'customerBalance', label: 'Balance' },
  { id: 'paymentMethod', label: 'Payment method' },
  { id: 'addresses', label: 'Billing & shipping' },
  { id: 'workSite', label: 'Work site' },
  { id: 'workScope', label: 'Work scope' },
  { id: 'documentDiscount', label: 'Discount' },
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
  { id: 'reference', label: 'PO' },
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
