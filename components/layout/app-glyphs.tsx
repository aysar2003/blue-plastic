import type { ReactNode, SVGProps } from 'react'

/**
 * Flat, multi-colour geometric marks for the app tiles (home grid, Apps menu).
 * Drawn for this app on a 48x48 grid: simple overlapping shapes in a small
 * shared palette, so they stay crisp from 20px to 60px and read on the dark tile.
 */
export const GLYPH_COLORS = {
  orange: '#F97E3E',
  amber: '#FDBA35',
  plum: '#9B4F86',
  plumDeep: '#6E3A63',
  teal: '#1FB5A8',
  tealDeep: '#118C82',
  blue: '#3DA5F4',
  pink: '#F06A9B',
  red: '#EE5D5D',
  paper: '#F4F1EE',
} as const

const C = GLYPH_COLORS

export type AppGlyphName =
  | 'pos'
  | 'sales'
  | 'customers'
  | 'purchases'
  | 'vendors'
  | 'banking'
  | 'payments'
  | 'inventory'
  | 'stores'
  | 'accounting'
  | 'journals'
  | 'reports'
  | 'bill-payments'
  | 'periods'
  | 'settings'
  | 'help'
  | 'items'

const GLYPHS: Record<AppGlyphName, ReactNode> = {
  // A till: plum body, teal screen, a yellow ticket coming out of the top.
  pos: (
    <>
      <rect x="15" y="6" width="18" height="14" rx="2" fill={C.amber} />
      <rect x="18" y="10" width="12" height="2" rx="1" fill={C.plumDeep} opacity="0.55" />
      <rect x="6" y="17" width="36" height="25" rx="5" fill={C.plum} />
      <rect x="11" y="22" width="26" height="9" rx="2.5" fill={C.teal} />
      <rect x="11" y="34" width="6" height="4" rx="1.5" fill={C.paper} opacity="0.9" />
      <rect x="21" y="34" width="6" height="4" rx="1.5" fill={C.paper} opacity="0.9" />
      <rect x="31" y="34" width="6" height="4" rx="1.5" fill={C.orange} />
    </>
  ),
  // A price tag with a rising chevron.
  sales: (
    <>
      <path d="M8 10a3 3 0 0 1 3-3h13.8a3 3 0 0 1 2.1.9l14.2 14.2a3 3 0 0 1 0 4.2L27.3 40.1a3 3 0 0 1-4.2 0L8.9 25.9A3 3 0 0 1 8 23.8Z" fill={C.orange} />
      <circle cx="16" cy="15" r="3.5" fill={C.paper} />
      <path d="M22 34l8-8 4 4 7-9" fill="none" stroke={C.teal} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // Two people: plum in front, teal behind.
  customers: (
    <>
      <circle cx="32" cy="15" r="6" fill={C.teal} />
      <path d="M21 36c0-7 5-12 11-12s11 5 11 12v2H21Z" fill={C.tealDeep} />
      <circle cx="18" cy="17" r="7" fill={C.pink} />
      <path d="M5 40c0-8 6-14 13-14s13 6 13 14v2H5Z" fill={C.plum} />
    </>
  ),
  // A shopping bag: plum bag, yellow handle, teal band.
  purchases: (
    <>
      <path d="M17 17v-3a7 7 0 0 1 14 0v3" fill="none" stroke={C.amber} strokeWidth="4" strokeLinecap="round" />
      <path d="M9 17h30l-2.5 23a3 3 0 0 1-3 2.7H14.5a3 3 0 0 1-3-2.7Z" fill={C.plum} />
      <rect x="10.2" y="24" width="27.6" height="6" fill={C.teal} />
    </>
  ),
  // A workshop: blue walls, plum saw-tooth roof, yellow windows.
  vendors: (
    <>
      <path d="M6 20l10-7v7l10-7v7l10-7v29H6Z" fill={C.plum} />
      <rect x="6" y="22" width="36" height="20" rx="1" fill={C.blue} />
      <rect x="11" y="27" width="6" height="5" rx="1" fill={C.amber} />
      <rect x="21" y="27" width="6" height="5" rx="1" fill={C.amber} />
      <rect x="31" y="27" width="6" height="15" rx="1" fill={C.plumDeep} />
      <rect x="36" y="6" width="5" height="10" rx="1" fill={C.orange} />
    </>
  ),
  // A bank: teal pediment, plum columns, yellow step.
  banking: (
    <>
      <path d="M24 5l19 10H5Z" fill={C.teal} />
      <rect x="9" y="18" width="6" height="16" rx="1.5" fill={C.plum} />
      <rect x="21" y="18" width="6" height="16" rx="1.5" fill={C.plum} />
      <rect x="33" y="18" width="6" height="16" rx="1.5" fill={C.plum} />
      <rect x="5" y="36" width="38" height="7" rx="2" fill={C.amber} />
    </>
  ),
  // A card and a coin with a circular arrow.
  payments: (
    <>
      <rect x="4" y="10" width="30" height="21" rx="4" fill={C.blue} />
      <rect x="4" y="15" width="30" height="5" fill={C.plumDeep} opacity="0.55" />
      <circle cx="32" cy="31" r="12" fill={C.amber} />
      <path d="M27 31a5 5 0 1 0 5-5" fill="none" stroke={C.plum} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M31 22.5l3 3.5-4 2.5Z" fill={C.plum} />
    </>
  ),
  // An open-top crate seen from the corner.
  inventory: (
    <>
      <path d="M24 6l17 9-17 9-17-9Z" fill={C.teal} />
      <path d="M7 15l17 9v19L7 34Z" fill={C.plum} />
      <path d="M41 15l-17 9v19l17-9Z" fill={C.blue} />
      <path d="M13.5 18.4l17-9 4 2.2-17 9Z" fill={C.amber} />
      <path d="M24 24l17-9v3.2L24 27.2Z" fill={C.tealDeep} opacity="0.5" />
    </>
  ),
  // A store-room: plum gable, teal roller door.
  stores: (
    <>
      <path d="M4 20L24 7l20 13v3H4Z" fill={C.plum} />
      <rect x="8" y="22" width="32" height="20" rx="1.5" fill={C.plumDeep} />
      <rect x="13" y="26" width="22" height="16" fill={C.teal} />
      <rect x="13" y="30" width="22" height="2" fill={C.tealDeep} />
      <rect x="13" y="35" width="22" height="2" fill={C.tealDeep} />
      <circle cx="24" cy="16" r="3" fill={C.amber} />
    </>
  ),
  // A balance: plum post, teal and yellow pans.
  accounting: (
    <>
      <rect x="22" y="8" width="4" height="30" rx="2" fill={C.plum} />
      <rect x="8" y="12" width="32" height="4" rx="2" fill={C.plum} />
      <rect x="14" y="38" width="20" height="5" rx="2.5" fill={C.plumDeep} />
      <path d="M5 26a7 7 0 0 0 14 0Z" fill={C.teal} />
      <path d="M12 16L5 26h14Z" fill="none" stroke={C.teal} strokeWidth="1.5" />
      <path d="M29 26a7 7 0 0 0 14 0Z" fill={C.amber} />
      <path d="M36 16l-7 10h14Z" fill="none" stroke={C.amber} strokeWidth="1.5" />
    </>
  ),
  // A ruled page with an orange pencil across it.
  journals: (
    <>
      <rect x="8" y="5" width="26" height="36" rx="3" fill={C.blue} />
      <rect x="13" y="12" width="16" height="3" rx="1.5" fill={C.paper} />
      <rect x="13" y="19" width="16" height="3" rx="1.5" fill={C.paper} />
      <rect x="13" y="26" width="10" height="3" rx="1.5" fill={C.paper} />
      <path d="M41.5 17.5l3 3L27 38l-5 1.5L23.5 34.5Z" fill={C.orange} />
      <path d="M41.5 17.5l3 3-2.5 2.5-3-3Z" fill={C.pink} />
    </>
  ),
  // A quarter pie beside rising bars.
  reports: (
    <>
      <rect x="27" y="24" width="6" height="18" rx="1.5" fill={C.amber} />
      <rect x="36" y="14" width="6" height="28" rx="1.5" fill={C.orange} />
      <path d="M20 8a14 14 0 1 0 14 14H20Z" fill={C.plum} />
      <path d="M23 5a14 14 0 0 1 14 14H23Z" fill={C.teal} />
    </>
  ),
  // A bill with a torn edge and a paid tick.
  'bill-payments': (
    <>
      <path d="M8 6h26v34l-4.3-3-4.4 3-4.3-3-4.3 3-4.4-3L8 40Z" fill={C.amber} />
      <rect x="13" y="12" width="16" height="3" rx="1.5" fill={C.plumDeep} opacity="0.6" />
      <rect x="13" y="19" width="11" height="3" rx="1.5" fill={C.plumDeep} opacity="0.6" />
      <circle cx="34" cy="33" r="10" fill={C.plum} />
      <path d="M29.5 33l3.2 3.2 6-6.4" fill="none" stroke={C.paper} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // A month page: teal header, plum days, one orange day.
  periods: (
    <>
      <rect x="6" y="8" width="36" height="34" rx="5" fill={C.plum} />
      <path d="M6 13a5 5 0 0 1 5-5h26a5 5 0 0 1 5 5v5H6Z" fill={C.teal} />
      <rect x="14" y="4" width="4" height="8" rx="2" fill={C.tealDeep} />
      <rect x="30" y="4" width="4" height="8" rx="2" fill={C.tealDeep} />
      <rect x="11" y="23" width="6" height="5" rx="1.2" fill={C.paper} opacity="0.85" />
      <rect x="21" y="23" width="6" height="5" rx="1.2" fill={C.paper} opacity="0.85" />
      <rect x="31" y="23" width="6" height="5" rx="1.2" fill={C.orange} />
      <rect x="11" y="32" width="6" height="5" rx="1.2" fill={C.paper} opacity="0.85" />
      <rect x="21" y="32" width="6" height="5" rx="1.2" fill={C.paper} opacity="0.85" />
    </>
  ),
  // Three sliders with round knobs.
  settings: (
    <>
      <rect x="6" y="10" width="36" height="5" rx="2.5" fill={C.plum} />
      <rect x="6" y="22" width="36" height="5" rx="2.5" fill={C.plum} />
      <rect x="6" y="34" width="36" height="5" rx="2.5" fill={C.plum} />
      <circle cx="16" cy="12.5" r="5.5" fill={C.orange} />
      <circle cx="32" cy="24.5" r="5.5" fill={C.teal} />
      <circle cx="21" cy="36.5" r="5.5" fill={C.amber} />
    </>
  ),
  // A speech bubble with a question mark dot.
  help: (
    <>
      <path d="M24 5c10.5 0 19 7.4 19 16.5S34.5 38 24 38c-2 0-3.9-.3-5.7-.8L9 42l2.2-8.2C7.4 30.8 5 26.4 5 21.5 5 12.4 13.5 5 24 5Z" fill={C.blue} />
      <path d="M19 17.5a5 5 0 1 1 7 4.6c-1.3.6-2 1.6-2 3V26" fill="none" stroke={C.paper} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="24" cy="31.5" r="2.4" fill={C.amber} />
    </>
  ),
  // Things you sell: a circle, a square and a triangle.
  items: (
    <>
      <circle cx="15" cy="15" r="9" fill={C.orange} />
      <rect x="25" y="6" width="17" height="17" rx="3" fill={C.teal} />
      <path d="M24 26l12 17H12Z" fill={C.plum} />
    </>
  ),
}

export function isAppGlyph(name: string | undefined): name is AppGlyphName {
  return typeof name === 'string' && Object.hasOwn(GLYPHS, name)
}

export function AppGlyph({ name, ...props }: { name: AppGlyphName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden focusable="false" shapeRendering="geometricPrecision" {...props}>
      {GLYPHS[name]}
    </svg>
  )
}
