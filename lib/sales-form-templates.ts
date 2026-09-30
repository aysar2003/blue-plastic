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
] as const

export type SalesFormTemplateId = (typeof SALES_FORM_TEMPLATES)[number]['id']

export const DEFAULT_SALES_FORM_TEMPLATE: SalesFormTemplateId = 'service'

export const SALES_FORM_TEMPLATE_STORAGE_KEY = 'bpc.salesFormTemplate'

export function isSalesFormTemplateId(value: string): value is SalesFormTemplateId {
  return SALES_FORM_TEMPLATES.some((template) => template.id === value)
}
