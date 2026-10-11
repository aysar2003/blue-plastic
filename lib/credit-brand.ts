/**
 * Odoo sheet chrome — purple primary used on sales/purchase forms and print.
 * Matches the community Odoo enterprise skin (#714B67 / #017E84).
 */
/** Live Odoo Enterprise form sheet (emaar-building Quotation / Invoice). */
export const FORM_SHEET = {
  ink: '#212529',
  accent: '#714B67',
  accentDeep: '#624159',
  accentSoft: '#9B738F',
  wash: '#F8F9FA',
  rowAlt: '#F8F9FA',
  border: '#DEE2E6',
  markA: '#212529',
  markB: '#714B67',
  markC: '#017E84',
  markD: '#DEE2E6',
} as const

/**
 * Credit documents are not invoices or bills — they reverse them.
 * Customer credit stays on the Odoo purple family; vendor credit uses Odoo teal.
 */
export const CUSTOMER_CREDIT = {
  ink: FORM_SHEET.ink,
  accent: FORM_SHEET.accent,
  accentDeep: FORM_SHEET.accentDeep,
  accentSoft: FORM_SHEET.accentSoft,
  wash: FORM_SHEET.wash,
  markA: FORM_SHEET.markA,
  markB: FORM_SHEET.markB,
  markC: FORM_SHEET.markC,
  markD: FORM_SHEET.markD,
} as const

export const VENDOR_CREDIT = {
  ink: '#0A4F53',
  accent: '#017E84',
  accentDeep: '#015F64',
  accentSoft: '#4AA8AD',
  wash: '#E8F5F5',
  markA: '#0A4F53',
  markB: '#017E84',
  markC: '#4AA8AD',
  markD: '#A8D5D7',
} as const
