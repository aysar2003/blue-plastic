/**
 * Product chrome tokens (POS, print sheets, PDF letterheads).
 * Default = SOM navy + cyan. Luxury VIP swaps to champagne gold.
 *
 * `purple` is navy/ink chrome only — never a button fill on dark cards.
 * Solid CTAs use `cta` / `teal` with `ctaInk` type.
 */

export type PosBrand = {
  purple: string
  purpleDark: string
  purpleDeep: string
  teal: string
  tealDark: string
  /** Soft teal/gold tint for secondary labels on dark panels. */
  tealSoft: string
  cta: string
  /** Text colour on solid CTA fills (white on cyan, espresso on gold). */
  ctaInk: string
  ink: string
  surface: string
  surfaceRaised: string
  wash: string
  paper: string
  muted: string
  line: string
  danger: string
}

export const ODOO: PosBrand = {
  purple: '#0b1220',
  purpleDark: '#070b14',
  purpleDeep: '#05080f',
  /** Solid CTAs — deep enough for white type; bright cyan stays on CSS --primary. */
  teal: '#0e7490',
  tealDark: '#155e75',
  tealSoft: '#9fe0e3',
  /** Alias of teal — use for every POS primary action button. */
  cta: '#0e7490',
  ctaInk: '#ffffff',
  ink: '#e2e8f0',
  surface: '#0d1524',
  surfaceRaised: '#141c2c',
  wash: '#f8fafc',
  paper: '#ffffff',
  muted: '#94a3b8',
  line: '#e2e8f0',
  danger: '#fb7185',
}

/** VIP champagne POS — matches html.luxury desk tokens. */
export const LUXURY_POS: PosBrand = {
  purple: '#07060a',
  purpleDark: '#050408',
  purpleDeep: '#030206',
  teal: '#c4a574',
  tealDark: '#a88b5c',
  tealSoft: '#e4d0a8',
  cta: '#c4a574',
  ctaInk: '#0a090c',
  ink: '#f3eee6',
  surface: '#100e14',
  surfaceRaised: '#16131c',
  wash: '#fbf7f0',
  paper: '#fbf7f0',
  muted: '#c4b8a8',
  line: 'rgb(196 165 116 / 0.22)',
  danger: '#fb7185',
}

/** PDF device RGB (0–1) for the product navy band + cyan accents. */
export const ODOO_PDF = {
  purple: [0.043, 0.071, 0.125] as const,
  purpleSoft: [0.89, 0.97, 0.99] as const,
  teal: [0.055, 0.455, 0.565] as const,
  ink: [0.07, 0.09, 0.11] as const,
  /** Secondary labels on white paper — dark enough to print clearly. */
  contact: [0.24, 0.3, 0.36] as const,
  muted: [0.35, 0.4, 0.45] as const,
  rule: [0.75, 0.8, 0.85] as const,
}

/** PDF device RGB for Luxury champagne letterhead. */
export const LUXURY_PDF = {
  purple: [0.027, 0.024, 0.039] as const,
  purpleSoft: [0.984, 0.969, 0.941] as const,
  teal: [0.769, 0.647, 0.455] as const,
  ink: [0.165, 0.129, 0.094] as const,
  contact: [0.36, 0.29, 0.21] as const,
  muted: [0.42, 0.35, 0.27] as const,
  rule: [0.83, 0.77, 0.66] as const,
}

export function isLuxuryDocument(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('luxury')
}

/** Sync read for event handlers / effects after mount. */
export function readPosBrand(): PosBrand {
  return isLuxuryDocument() ? LUXURY_POS : ODOO
}
