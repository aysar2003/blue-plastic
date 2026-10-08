/**
 * Odoo POS / document brand tokens.
 * Used by the till chrome, print sheets, and PDF letterheads.
 */
export const ODOO = {
  purple: '#714B67',
  purpleDark: '#5c3d55',
  purpleDeep: '#4a3144',
  teal: '#017e84',
  tealDark: '#01666b',
  ink: '#1f1f23',
  surface: '#2a2a2e',
  surfaceRaised: '#3a3a40',
  wash: '#f5f5f5',
  paper: '#ffffff',
  muted: '#8c8c8c',
  line: '#e0e0e0',
  danger: '#d23f3f',
} as const

/** PDF device RGB (0–1) for the Odoo purple band. */
export const ODOO_PDF = {
  purple: [0.443, 0.294, 0.404] as const,
  purpleSoft: [0.92, 0.88, 0.91] as const,
  teal: [0.004, 0.494, 0.518] as const,
  ink: [0.12, 0.12, 0.14] as const,
  muted: [0.45, 0.45, 0.45] as const,
  rule: [0.75, 0.75, 0.75] as const,
}
