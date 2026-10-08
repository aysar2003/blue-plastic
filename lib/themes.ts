/**
 * Colour themes for the whole application. Each id is a class on <html>,
 * and the matching variables live in app/globals.css so every screen uses them.
 */
export type ThemeId =
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
  group?: 'odoo' | 'color' | 'night'
}

export const THEMES: ThemeOption[] = [
  {
    id: 'odoo',
    label: 'Odoo',
    blurb: 'Full brand skin: purple navbar, teal links, Inter, flat grey workspace',
    swatches: ['#F0EEEE', '#714B67', '#017E84'],
    group: 'odoo',
  },
  {
    id: 'odoo-dark',
    label: 'Odoo Dark',
    blurb: 'Full brand skin on dark: purple navbar, plum actions, teal accents',
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
  { id: 'odoo', title: 'Odoo', hint: 'Brand plum + teal for the whole system (lists, forms, reports, POS).' },
  { id: 'color', title: 'Colour shells', hint: 'Other workspaces if you prefer a different accent.' },
  { id: 'night', title: 'Night', hint: 'Low-light desks.' },
]
