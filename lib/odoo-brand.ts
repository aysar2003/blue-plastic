/**
 * Product chrome tokens (POS, print sheets, PDF letterheads).
 * Aligned with the SOM ERP website: navy ground, cyan accent.
 */
export const ODOO = {
  purple: '#0b1220',
  purpleDark: '#070b14',
  purpleDeep: '#05080f',
  /** Solid CTAs — deep enough for white type; bright cyan stays on CSS --primary. */
  teal: '#0e7490',
  tealDark: '#155e75',
  ink: '#e2e8f0',
  surface: '#0d1524',
  surfaceRaised: '#141c2c',
  wash: '#f8fafc',
  paper: '#ffffff',
  muted: '#94a3b8',
  line: '#e2e8f0',
  danger: '#fb7185',
} as const

/** PDF device RGB (0–1) for the product navy band + cyan accents. */
export const ODOO_PDF = {
  purple: [0.043, 0.071, 0.125] as const,
  purpleSoft: [0.89, 0.97, 0.99] as const,
  teal: [0.055, 0.455, 0.565] as const,
  ink: [0.07, 0.09, 0.11] as const,
  muted: [0.58, 0.64, 0.72] as const,
  rule: [0.75, 0.8, 0.85] as const,
}
