/**
 * Colour themes for the whole application. Each id is a class on <html>,
 * and the matching variables live in app/globals.css so every screen uses them.
 */
export type ThemeId =
  | 'som'
  | 'quick'
  | 'quick-dark'
  | 'odoo'
  | 'odoo-dark'
  | 'ocean'
  | 'lagoon'
  | 'forest'
  | 'amber'
  | 'violet'
  | 'rose'
  | 'indigo'
  | 'sand'
  | 'dark'
  | 'ink'

export type ThemeOption = {
  id: ThemeId
  label: string
  blurb: string
  /** Preview chips, in order: ground, accent, ink. */
  swatches: [string, string, string]
  /** Optional group label for the appearance picker. */
  group?: 'som' | 'quick' | 'odoo' | 'color' | 'night'
}

export const THEMES: ThemeOption[] = [
  {
    id: 'som',
    label: 'SOM ERP',
    blurb: 'Product night desk: navy #070b14 ground, cyan #22d3ee CTAs and links',
    swatches: ['#070b14', '#22d3ee', '#0b1220'],
    group: 'som',
  },
  {
    id: 'quick',
    label: 'QuickBooks',
    blurb: 'QBO clone: Source Sans, green #2CA01C bar, soft grey lists, green CTAs',
    swatches: ['#ECEEF1', '#2CA01C', '#393A3D'],
    group: 'quick',
  },
  {
    id: 'quick-dark',
    label: 'QuickBooks Dark',
    blurb: 'Same QBO green on a dark desk for night work',
    swatches: ['#1A1F1A', '#2CA01C', '#E8F5E9'],
    group: 'quick',
  },
  {
    id: 'odoo',
    label: 'Odoo',
    blurb: 'Live Odoo look: light navbar, plum #714B67 buttons, teal #017E84 links, #F8F9FA desk',
    swatches: ['#F8F9FA', '#714B67', '#017E84'],
    group: 'odoo',
  },
  {
    id: 'odoo-dark',
    label: 'Odoo Dark',
    blurb: 'Same Odoo plum + teal on a dark desk',
    swatches: ['#1F1F23', '#714B67', '#017E84'],
    group: 'odoo',
  },
  { id: 'ocean', label: 'Ocean', blurb: 'Blue ground, deep water accent', swatches: ['#d7ebf6', '#0B4F6C', '#14324a'], group: 'color' },
  { id: 'lagoon', label: 'Lagoon', blurb: 'Teal ground, green-blue accent', swatches: ['#d5f3ee', '#0F766E', '#134e4a'], group: 'color' },
  { id: 'forest', label: 'Forest', blurb: 'Leaf ground, deep green accent', swatches: ['#dcf5e4', '#166534', '#14532d'], group: 'color' },
  { id: 'amber', label: 'Amber', blurb: 'Warm ground, bronze accent', swatches: ['#fdecc8', '#B45309', '#78350f'], group: 'color' },
  { id: 'violet', label: 'Violet', blurb: 'Lilac ground, purple accent', swatches: ['#ede4fb', '#6D28D9', '#4c1d95'], group: 'color' },
  { id: 'rose', label: 'Rose', blurb: 'Blush ground, crimson accent', swatches: ['#fde2e8', '#BE123C', '#881337'], group: 'color' },
  { id: 'indigo', label: 'Indigo', blurb: 'Periwinkle ground, ink accent', swatches: ['#e0e7ff', '#3730A3', '#1e1b4b'], group: 'color' },
  { id: 'sand', label: 'Sand', blurb: 'Warm stone ground, copper accent', swatches: ['#f3e6d4', '#9A3412', '#7c2d12'], group: 'color' },
  { id: 'dark', label: 'Dark', blurb: 'Night ground, light text', swatches: ['#12202b', '#7dd3fc', '#e8f1f8'], group: 'night' },
  {
    id: 'ink',
    label: 'Ink',
    blurb: 'Black ground, white type, gray panels',
    swatches: ['#000000', '#ededed', '#2e2e2e'],
    group: 'night',
  },
]

export const THEME_IDS = THEMES.map((theme) => theme.id)

export const THEME_GROUPS: { id: ThemeOption['group']; title: string; hint: string }[] = [
  {
    id: 'som',
    title: 'SOM ERP',
    hint: 'The product look from the login page — deep navy desk and cyan actions. Best match for the public website.',
  },
  {
    id: 'quick',
    title: 'QuickBooks Online',
    hint: 'Full QBO look: green top bar, Source Sans, soft grey desk, green buttons — and QuickBooks report paper.',
  },
  {
    id: 'odoo',
    title: 'Odoo',
    hint: 'Live Odoo Accounting: light top bar, plum buttons, teal links, system fonts — and Odoo report paper.',
  },
  { id: 'color', title: 'Colour shells', hint: 'Other workspaces if you prefer a different accent.' },
  { id: 'night', title: 'Night', hint: 'Low-light desks.' },
]
