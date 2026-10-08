/**
 * Odoo sheet chrome — purple primary used on sales/purchase forms and print.
 * Matches the community Odoo enterprise skin (#714B67 / #017E84).
 */
export const FORM_SHEET = {
  ink: '#3F2C38',
  accent: '#714B67',
  accentDeep: '#5A3B52',
  accentSoft: '#9B738F',
  wash: '#F3EEF2',
  rowAlt: '#F7F2F5',
  border: '#D4C4CE',
  markA: '#3F2C38',
  markB: '#714B67',
  markC: '#9B738F',
  markD: '#D4C4CE',
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
