/**
 * Colour themes for the whole application. Each id is a class on <html>,
 * and the matching variables live in app/globals.css so every screen uses them.
 */
export type ThemeId =
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
}

export const THEMES: ThemeOption[] = [
  { id: 'ocean', label: 'Ocean', blurb: 'Blue ground, deep water accent', swatches: ['#d7ebf6', '#0B4F6C', '#14324a'] },
  { id: 'lagoon', label: 'Lagoon', blurb: 'Teal ground, green-blue accent', swatches: ['#d5f3ee', '#0F766E', '#134e4a'] },
  { id: 'forest', label: 'Forest', blurb: 'Leaf ground, deep green accent', swatches: ['#dcf5e4', '#166534', '#14532d'] },
  { id: 'amber', label: 'Amber', blurb: 'Warm ground, bronze accent', swatches: ['#fdecc8', '#B45309', '#78350f'] },
  { id: 'violet', label: 'Violet', blurb: 'Lilac ground, purple accent', swatches: ['#ede4fb', '#6D28D9', '#4c1d95'] },
  { id: 'rose', label: 'Rose', blurb: 'Blush ground, crimson accent', swatches: ['#fde2e8', '#BE123C', '#881337'] },
  { id: 'indigo', label: 'Indigo', blurb: 'Periwinkle ground, ink accent', swatches: ['#e0e7ff', '#3730A3', '#1e1b4b'] },
  { id: 'sand', label: 'Sand', blurb: 'Warm stone ground, copper accent', swatches: ['#f3e6d4', '#9A3412', '#7c2d12'] },
  { id: 'dark', label: 'Dark', blurb: 'Night ground, light text', swatches: ['#12202b', '#7dd3fc', '#e8f1f8'] },
  {
    id: 'ink',
    label: 'Ink',
    blurb: 'Black ground, white type, gray panels',
    swatches: ['#000000', '#ededed', '#2e2e2e'],
  },
]

export const THEME_IDS = THEMES.map((theme) => theme.id)
