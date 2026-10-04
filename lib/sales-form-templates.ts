/**
 * Standard sales form layouts. Same fields and posting rules; only the sheet
 * arrangement changes — the way service businesses pick an invoice look.
 */
export const SALES_FORM_TEMPLATES = [
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
  {
    id: 'sheet',
    label: 'Sheet',
    blurb: 'Name at the top right and a navy line table — the printed invoice.',
  },
] as const

export type SalesFormTemplateId = (typeof SALES_FORM_TEMPLATES)[number]['id']

/**
 * The ruled invoice / quotation sheet, plus the other layouts.
 * Invoice and quotation share this list so both open the same form.
 */
export const INVOICE_FORM_TEMPLATES = [
  {
    id: 'invoice',
    label: 'Standard',
    blurb: 'Customer, addresses, dates, lines, and the total — same sheet for invoice and quotation.',
  },
  ...SALES_FORM_TEMPLATES,
] as const

export type InvoiceFormTemplateId = (typeof INVOICE_FORM_TEMPLATES)[number]['id']

export const DEFAULT_SALES_FORM_TEMPLATE: SalesFormTemplateId = 'service'

/** The same sheet as an invoice, plus the other layouts. */
export const SALES_RECEIPT_FORM_TEMPLATES = [
  {
    id: 'invoice',
    label: 'Standard',
    blurb: 'The invoice sheet: customer, addresses, lines, and the amount received.',
  },
  ...SALES_FORM_TEMPLATES,
] as const

export type SalesReceiptFormTemplateId = (typeof SALES_RECEIPT_FORM_TEMPLATES)[number]['id']

export const SALES_FORM_TEMPLATE_STORAGE_KEY = 'bpc.salesFormTemplate'
export const INVOICE_FORM_TEMPLATE_STORAGE_KEY = 'bpc.invoiceFormTemplate'
export const SALES_RECEIPT_FORM_TEMPLATE_STORAGE_KEY = 'bpc.salesReceiptFormTemplate'

export function isSalesFormTemplateId(value: string): value is SalesFormTemplateId {
  return SALES_FORM_TEMPLATES.some((template) => template.id === value)
}

export function isInvoiceFormTemplateId(value: string): value is InvoiceFormTemplateId {
  return INVOICE_FORM_TEMPLATES.some((template) => template.id === value)
}

export function isSalesReceiptFormTemplateId(value: string): value is SalesReceiptFormTemplateId {
  return SALES_RECEIPT_FORM_TEMPLATES.some((template) => template.id === value)
}
