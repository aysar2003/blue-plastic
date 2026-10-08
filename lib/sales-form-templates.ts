/**
 * Standard sales form layouts. Same fields and posting rules; only the sheet
 * arrangement changes — the way service businesses pick an invoice look.
 *
 * Invoice, quotation, sales receipt, and credit memo use the print **sheet**
 * as the standard paper (the same layout POS and receipts print on).
 */
export const SALES_FORM_TEMPLATES = [
  {
    id: 'sheet',
    label: 'Sheet',
    blurb: 'The standard print paper — same layout as invoice, sales receipt, and POS.',
  },
  {
    id: 'classic',
    label: 'Classic',
    blurb: 'Dense table — accounts and office sales.',
  },
  {
    id: 'service',
    label: 'Service',
    blurb: 'Hours and description first — trades and consulting.',
  },
  {
    id: 'modern',
    label: 'Modern',
    blurb: 'One branded sheet — customer-facing quotes.',
  },
] as const

export type SalesFormTemplateId = (typeof SALES_FORM_TEMPLATES)[number]['id']

/**
 * Optional alternate layouts. The live invoice / quotation form always opens
 * on the print sheet; these remain for older saved preferences.
 */
export const INVOICE_FORM_TEMPLATES = [
  {
    id: 'sheet',
    label: 'Sheet',
    blurb: 'The standard print paper — same as sales receipt and POS.',
  },
  {
    id: 'invoice',
    label: 'Office',
    blurb: 'Customer, addresses, dates, lines, and the total — denser office entry.',
  },
  ...SALES_FORM_TEMPLATES.filter((template) => template.id !== 'sheet'),
] as const

export type InvoiceFormTemplateId = (typeof INVOICE_FORM_TEMPLATES)[number]['id']

/** Print-ready sheet is the default for every customer-facing sales paper. */
export const DEFAULT_SALES_FORM_TEMPLATE: SalesFormTemplateId = 'sheet'
export const DEFAULT_INVOICE_FORM_TEMPLATE: InvoiceFormTemplateId = 'sheet'

/** The same sheet as an invoice, plus the other layouts. */
export const SALES_RECEIPT_FORM_TEMPLATES = [
  {
    id: 'sheet',
    label: 'Sheet',
    blurb: 'The standard print paper — same as invoice and POS receipt.',
  },
  {
    id: 'invoice',
    label: 'Office',
    blurb: 'Customer, addresses, lines, and the amount received.',
  },
  ...SALES_FORM_TEMPLATES.filter((template) => template.id !== 'sheet'),
] as const

export type SalesReceiptFormTemplateId = (typeof SALES_RECEIPT_FORM_TEMPLATES)[number]['id']

export const DEFAULT_SALES_RECEIPT_FORM_TEMPLATE: SalesReceiptFormTemplateId = 'sheet'

export const SALES_FORM_TEMPLATE_STORAGE_KEY = 'bpc.salesFormTemplate'
export const INVOICE_FORM_TEMPLATE_STORAGE_KEY = 'bpc.invoiceFormTemplate'
export const SALES_RECEIPT_FORM_TEMPLATE_STORAGE_KEY = 'bpc.salesReceiptFormTemplate'

/**
 * Documents that always open on the printable sheet — invoice, quotation,
 * sales receipt, credit memo, and refund — so POS and counter sales match.
 */
export const PRINT_SHEET_SALES_TYPES = [
  'INVOICE',
  'ESTIMATE',
  'SALES_RECEIPT',
  'CREDIT_MEMO',
  'REFUND_RECEIPT',
] as const

export function isSalesFormTemplateId(value: string): value is SalesFormTemplateId {
  return SALES_FORM_TEMPLATES.some((template) => template.id === value)
}

export function isInvoiceFormTemplateId(value: string): value is InvoiceFormTemplateId {
  return INVOICE_FORM_TEMPLATES.some((template) => template.id === value)
}

export function isSalesReceiptFormTemplateId(value: string): value is SalesReceiptFormTemplateId {
  return SALES_RECEIPT_FORM_TEMPLATES.some((template) => template.id === value)
}
