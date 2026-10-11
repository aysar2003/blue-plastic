/**
 * System-wide type size and typeface. Stored in this browser; applied as
 * data-font-size / data-font-style on <html> so every screen follows.
 */

export const FONT_SIZE_KEY = 'bpc.fontSize'
export const FONT_STYLE_KEY = 'bpc.fontStyle'

export type FontSizeId = 'sm' | 'md' | 'lg' | 'xl'
export type FontStyleId = 'default' | 'geist' | 'inter' | 'source-sans' | 'system'

export type FontOption<T extends string> = {
  id: T
  label: string
  blurb: string
}

export const FONT_SIZES: FontOption<FontSizeId>[] = [
  { id: 'sm', label: 'Small', blurb: 'More rows on screen.' },
  { id: 'md', label: 'Medium', blurb: 'The size the books open with.' },
  { id: 'lg', label: 'Large', blurb: 'Easier to read at a desk.' },
  { id: 'xl', label: 'Extra large', blurb: 'Biggest comfortable size.' },
]

export const FONT_STYLES: FontOption<FontStyleId>[] = [
  { id: 'default', label: 'Theme default', blurb: 'Follows QuickBooks / Odoo / Hero ERP.' },
  { id: 'geist', label: 'Geist', blurb: 'Clean modern sans used by Hero ERP.' },
  { id: 'inter', label: 'Inter', blurb: 'Odoo-style UI typeface.' },
  { id: 'source-sans', label: 'Source Sans', blurb: 'QuickBooks-style report typeface.' },
  { id: 'system', label: 'System', blurb: 'Whatever fonts this computer prefers.' },
]

export const DEFAULT_FONT_SIZE: FontSizeId = 'md'
export const DEFAULT_FONT_STYLE: FontStyleId = 'default'

export function parseFontSize(raw: string | null | undefined): FontSizeId {
  if (raw === 'sm' || raw === 'md' || raw === 'lg' || raw === 'xl') return raw
  return DEFAULT_FONT_SIZE
}

export function parseFontStyle(raw: string | null | undefined): FontStyleId {
  if (
    raw === 'default' ||
    raw === 'geist' ||
    raw === 'inter' ||
    raw === 'source-sans' ||
    raw === 'system'
  ) {
    return raw
  }
  return DEFAULT_FONT_STYLE
}
