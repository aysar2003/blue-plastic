/**
 * System-wide type size and typeface. Stored in this browser; applied as
 * data-font-size / data-font-style on <html> so every screen follows.
 * Custom size uses --ui-font-px; custom style uses --ui-font-family.
 */

export const FONT_SIZE_KEY = 'bpc.fontSize'
export const FONT_SIZE_PX_KEY = 'bpc.fontSizePx'
export const FONT_STYLE_KEY = 'bpc.fontStyle'
export const FONT_STYLE_CUSTOM_KEY = 'bpc.fontStyleCustom'

export type FontSizeId = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'custom'
export type FontStyleId =
  | 'default'
  | 'geist'
  | 'inter'
  | 'source-sans'
  | 'jakarta'
  | 'fraunces'
  | 'mono'
  | 'system'
  | 'georgia'
  | 'custom'

export type FontOption<T extends string> = {
  id: T
  label: string
  blurb: string
  /** Preview size hint for the appearance list (rem). */
  previewRem?: string
  /** CSS font-family preview for style chips. */
  previewFamily?: string
}

export const FONT_SIZES: FontOption<FontSizeId>[] = [
  { id: 'xs', label: 'Extra small', blurb: 'Dense lists — most rows visible.', previewRem: '0.72rem' },
  { id: 'sm', label: 'Small', blurb: 'More rows on screen.', previewRem: '0.8rem' },
  { id: 'md', label: 'Medium', blurb: 'The size the books open with.', previewRem: '0.95rem' },
  { id: 'lg', label: 'Large', blurb: 'Easier to read at a desk.', previewRem: '1.1rem' },
  { id: 'xl', label: 'Extra large', blurb: 'Comfortable distance reading.', previewRem: '1.25rem' },
  { id: '2xl', label: 'Huge', blurb: 'Biggest preset before custom.', previewRem: '1.4rem' },
  { id: 'custom', label: 'Custom', blurb: 'Set your own pixel size with the slider.', previewRem: '1rem' },
]

export const FONT_STYLES: FontOption<FontStyleId>[] = [
  {
    id: 'default',
    label: 'Theme default',
    blurb: 'Follows Odoo / SOM ERP fonts for the desk.',
  },
  {
    id: 'geist',
    label: 'Geist',
    blurb: 'Clean modern sans used by Hero ERP.',
    previewFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: 'inter',
    label: 'Inter',
    blurb: 'Odoo-style UI typeface.',
    previewFamily: 'var(--font-odoo), system-ui, sans-serif',
  },
  {
    id: 'source-sans',
    label: 'Source Sans',
    blurb: 'QuickBooks-style report typeface.',
    previewFamily: 'var(--font-quickbooks), Arial, Helvetica, sans-serif',
  },
  {
    id: 'jakarta',
    label: 'Plus Jakarta',
    blurb: 'Marketing site body — rounded modern sans.',
    previewFamily: 'var(--font-marketing-sans), system-ui, sans-serif',
  },
  {
    id: 'fraunces',
    label: 'Fraunces',
    blurb: 'Display serif — soft luxury headings feel.',
    previewFamily: 'var(--font-marketing-display), Georgia, serif',
  },
  {
    id: 'mono',
    label: 'Geist Mono',
    blurb: 'Monospace for dense ledgers and codes.',
    previewFamily: 'var(--font-geist-mono), ui-monospace, monospace',
  },
  {
    id: 'georgia',
    label: 'Georgia',
    blurb: 'Classic system serif — readable long copy.',
    previewFamily: "Georgia, 'Times New Roman', Times, serif",
  },
  {
    id: 'system',
    label: 'System UI',
    blurb: 'Whatever fonts this computer prefers.',
    previewFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  {
    id: 'custom',
    label: 'Custom stack',
    blurb: 'Type any CSS font-family stack yourself.',
  },
]

/** Preset stacks offered beside free-typed custom. */
export const FONT_CUSTOM_PRESETS: { id: string; label: string; stack: string }[] = [
  {
    id: 'avenir',
    label: 'Avenir / Helvetica',
    stack: 'Avenir Next, Avenir, Helvetica Neue, Helvetica, Arial, sans-serif',
  },
  {
    id: 'segoe',
    label: 'Segoe UI',
    stack: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  {
    id: 'verdana',
    label: 'Verdana',
    stack: 'Verdana, Geneva, Tahoma, sans-serif',
  },
  {
    id: 'trebuchet',
    label: 'Trebuchet',
    stack: "'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', sans-serif",
  },
  {
    id: 'palatino',
    label: 'Palatino',
    stack: "Palatino Linotype, Palatino, 'Book Antiqua', Georgia, serif",
  },
  {
    id: 'courier',
    label: 'Courier',
    stack: "'Courier New', Courier, monospace",
  },
]

export const DEFAULT_FONT_SIZE: FontSizeId = 'md'
export const DEFAULT_FONT_STYLE: FontStyleId = 'default'
export const DEFAULT_FONT_SIZE_PX = 14
export const MIN_FONT_SIZE_PX = 11
export const MAX_FONT_SIZE_PX = 22
export const DEFAULT_FONT_STYLE_CUSTOM = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'

const SIZE_IDS = new Set<string>(FONT_SIZES.map((item) => item.id))
const STYLE_IDS = new Set<string>(FONT_STYLES.map((item) => item.id))

export function parseFontSize(raw: string | null | undefined): FontSizeId {
  if (raw && SIZE_IDS.has(raw)) return raw as FontSizeId
  return DEFAULT_FONT_SIZE
}

export function parseFontStyle(raw: string | null | undefined): FontStyleId {
  if (raw && STYLE_IDS.has(raw)) return raw as FontStyleId
  return DEFAULT_FONT_STYLE
}

export function parseFontSizePx(raw: string | null | undefined): number {
  if (raw == null || raw.trim() === '') return DEFAULT_FONT_SIZE_PX
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_FONT_SIZE_PX
  return Math.min(MAX_FONT_SIZE_PX, Math.max(MIN_FONT_SIZE_PX, Math.round(n)))
}

export function parseFontStyleCustom(raw: string | null | undefined): string {
  const value = (raw ?? '').trim()
  if (!value || value.length > 160) return DEFAULT_FONT_STYLE_CUSTOM
  // Block obvious injection / url() stacks.
  if (/url\s*\(|expression\s*\(|@import|<\/?/i.test(value)) return DEFAULT_FONT_STYLE_CUSTOM
  return value
}

export function fontFamilyForStyle(
  style: FontStyleId,
  customStack?: string | null,
): string | undefined {
  if (style === 'custom') return parseFontStyleCustom(customStack)
  return FONT_STYLES.find((item) => item.id === style)?.previewFamily
}
