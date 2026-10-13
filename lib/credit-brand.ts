/**
 * Product sheet chrome — SOM ERP website navy / cyan.
 * Uses CSS variables so Appearance themes recolour forms with the desk.
 * Solid bands use a deepened primary so light type stays readable on cyan themes.
 */
export const FORM_SHEET = {
  ink: 'var(--foreground)',
  /** Labels, links, and hairlines. */
  accent: 'var(--primary)',
  accentDeep: 'color-mix(in srgb, var(--primary) 72%, #000000)',
  accentSoft: 'var(--accent-foreground)',
  /** Masthead / column head — deep enough for light type on bright accents. */
  band: 'color-mix(in srgb, var(--primary) 30%, #070b14)',
  wash: 'color-mix(in srgb, var(--primary) 10%, var(--card))',
  rowAlt: 'var(--muted)',
  border: 'var(--border)',
  markA: 'color-mix(in srgb, var(--primary) 50%, #070b14)',
  markB: 'var(--primary)',
  markC: 'var(--accent-foreground)',
  markD: 'color-mix(in srgb, var(--border) 80%, transparent)',
} as const

/**
 * Credit documents reverse invoices / bills.
 * Customer credit stays on the product accent; vendor credit uses success teal.
 */
export const CUSTOMER_CREDIT = {
  ink: FORM_SHEET.ink,
  accent: FORM_SHEET.accent,
  accentDeep: FORM_SHEET.accentDeep,
  accentSoft: FORM_SHEET.accentSoft,
  band: FORM_SHEET.band,
  wash: FORM_SHEET.wash,
  markA: FORM_SHEET.markA,
  markB: FORM_SHEET.markB,
  markC: FORM_SHEET.markC,
  markD: FORM_SHEET.markD,
} as const

export const VENDOR_CREDIT = {
  ink: 'var(--foreground)',
  accent: 'var(--success)',
  accentDeep: 'color-mix(in srgb, var(--success) 72%, #000000)',
  accentSoft: 'var(--accent-foreground)',
  band: 'color-mix(in srgb, var(--success) 30%, #070b14)',
  wash: 'color-mix(in srgb, var(--success) 10%, var(--card))',
  markA: 'color-mix(in srgb, var(--success) 50%, #070b14)',
  markB: 'var(--success)',
  markC: 'var(--accent-foreground)',
  markD: 'color-mix(in srgb, var(--border) 80%, transparent)',
} as const
