/**
 * How report sheets are drawn — separate from colour themes.
 * Stored in this browser under REPORT_STYLE_KEY; applied as data-report-style on <html>.
 * Custom paper stores sheet / band / accent under REPORT_STYLE_CUSTOM_KEY.
 *
 * World clones (QuickBooks, Odoo, Xero, Sage, Wave, FreshBooks, Zoho, SAP,
 * Dynamics, NetSuite) use public brand palette colours for recognisable paper —
 * not affiliated with or endorsed by those vendors.
 */

export type ReportStyleId =
  | 'herobooks'
  | 'quickbooks'
  | 'odoo'
  | 'xero'
  | 'sage'
  | 'wave'
  | 'freshbooks'
  | 'zoho'
  | 'sap'
  | 'dynamics'
  | 'netsuite'
  | 'luxury'
  | 'ai'
  | 'ink'
  | 'slate'
  | 'emerald'
  | 'sand'
  | 'custom'

export const REPORT_STYLE_KEY = 'bpc.reportStyle'
export const REPORT_STYLE_CUSTOM_KEY = 'bpc.reportStyleCustom'

export type ReportStyleOption = {
  id: ReportStyleId
  label: string
  blurb: string
  /** Preview chips: sheet, band, accent. */
  swatches: [string, string, string]
}

export type ReportStyleCustom = {
  sheet: string
  band: string
  accent: string
}

export const REPORT_STYLES: ReportStyleOption[] = [
  {
    id: 'herobooks',
    label: 'SOM ERP',
    blurb: 'Banded ledger rows using your theme colours.',
    swatches: ['#FFFFFF', '#D5DDE6', '#0F766E'],
  },
  {
    id: 'quickbooks',
    label: 'QuickBooks',
    blurb: 'Source Sans, soft blue bands, green section marks.',
    swatches: ['#FFFFFF', '#E8EEF4', '#2CA01C'],
  },
  {
    id: 'odoo',
    label: 'Odoo',
    blurb: 'Grey total bands, solid masthead, white sheet.',
    swatches: ['#FFFFFF', '#DEE2E6', '#714B67'],
  },
  {
    id: 'xero',
    label: 'Xero',
    blurb: 'Navy masthead, flat white rows, teal total underline.',
    swatches: ['#FFFFFF', '#000856', '#50DCAA'],
  },
  {
    id: 'sage',
    label: 'Sage',
    blurb: 'Minimal white paper — green top edge, filled green totals.',
    swatches: ['#FFFFFF', '#E5E5E5', '#00D639'],
  },
  {
    id: 'wave',
    label: 'Wave',
    blurb: 'Soft cream sheet, pill masthead, orange total marks.',
    swatches: ['#F9F4F1', '#0040FF', '#FD6F00'],
  },
  {
    id: 'freshbooks',
    label: 'FreshBooks',
    blurb: 'Midnight navy header bar, soft blue zebra rows.',
    swatches: ['#FFFFFF', '#001B40', '#0075DD'],
  },
  {
    id: 'zoho',
    label: 'Zoho Books',
    blurb: 'Blue column head, full cell grid, red total rule.',
    swatches: ['#FFFFFF', '#226DB4', '#E42527'],
  },
  {
    id: 'sap',
    label: 'SAP',
    blurb: 'IBCS greyscale — charcoal head, double rules, no zebra.',
    swatches: ['#FFFFFF', '#233549', '#0070F2'],
  },
  {
    id: 'dynamics',
    label: 'Dynamics 365',
    blurb: 'Fluent left teal bar, Segoe type, soft grey zebra.',
    swatches: ['#FAF9F8', '#F3F2F1', '#00B7C3'],
  },
  {
    id: 'netsuite',
    label: 'NetSuite',
    blurb: 'Dense brown head bar, charcoal totals, tight rows.',
    swatches: ['#FFFFFF', '#BE4529', '#403C38'],
  },
  {
    id: 'luxury',
    label: 'Luxury',
    blurb: 'Warm cream sheet, champagne bands, gold accent — dark ink so VIP desks stay readable.',
    swatches: ['#FBF7F0', '#E8DCC8', '#C4A574'],
  },
  {
    id: 'ai',
    label: 'AI',
    blurb: 'Neural midnight sheet, azure bands, cyan marks — matches the VIP AI desk.',
    swatches: ['#0B1220', '#121C30', '#3B82F6'],
  },
  {
    id: 'ink',
    label: 'Ink',
    blurb: 'Near-black paper for night reading — light type.',
    swatches: ['#0A0A0A', '#171717', '#EDEDED'],
  },
  {
    id: 'slate',
    label: 'Slate',
    blurb: 'Cool grey bands, steel accent — quiet boardroom.',
    swatches: ['#F8FAFC', '#E2E8F0', '#475569'],
  },
  {
    id: 'emerald',
    label: 'Emerald',
    blurb: 'Soft mint bands with deep green marks.',
    swatches: ['#F0FDF4', '#DCFCE7', '#166534'],
  },
  {
    id: 'sand',
    label: 'Sand',
    blurb: 'Warm stone bands, copper accent.',
    swatches: ['#FFFBEB', '#FDE68A', '#9A3412'],
  },
  {
    id: 'custom',
    label: 'Custom paper',
    blurb: 'Pick your own sheet, band, and accent colours.',
    swatches: ['#FFFFFF', '#E5E7EB', '#C4A574'],
  },
]

export const REPORT_STYLE_IDS = REPORT_STYLES.map((style) => style.id)

export const DEFAULT_REPORT_STYLE: ReportStyleId = 'herobooks'

export const DEFAULT_REPORT_CUSTOM: ReportStyleCustom = {
  sheet: '#FFFFFF',
  band: '#E8DCC8',
  accent: '#C4A574',
}

const STYLE_IDS = new Set<string>(REPORT_STYLE_IDS)

export function parseReportStyle(raw: string | null | undefined): ReportStyleId {
  if (raw && STYLE_IDS.has(raw)) return raw as ReportStyleId
  return DEFAULT_REPORT_STYLE
}

function parseHex(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const value = raw.trim()
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
}

export function parseReportStyleCustom(raw: string | null | undefined): ReportStyleCustom {
  if (!raw) return { ...DEFAULT_REPORT_CUSTOM }
  try {
    const data = JSON.parse(raw) as Partial<ReportStyleCustom>
    return {
      sheet: parseHex(data.sheet, DEFAULT_REPORT_CUSTOM.sheet),
      band: parseHex(data.band, DEFAULT_REPORT_CUSTOM.band),
      accent: parseHex(data.accent, DEFAULT_REPORT_CUSTOM.accent),
    }
  } catch {
    return { ...DEFAULT_REPORT_CUSTOM }
  }
}

/**
 * Report paper that belongs with a System look brand skin.
 * SOM / colour shells → SOM ERP sheet so a leftover Odoo/QBO pick cannot
 * steal the website navy+cyan after the desk already matches the site.
 * VIP skins always pair with their own paper (Luxury cream / AI neural).
 */
export function reportStyleForTheme(themeId: string | undefined | null): ReportStyleId {
  if (themeId === 'odoo' || themeId === 'odoo-dark') return 'odoo'
  if (themeId === 'luxury') return 'luxury'
  if (themeId === 'ai') return 'ai'
  if (themeId === 'ink') return 'ink'
  return 'herobooks'
}

/** True when the desk is a VIP skin that must keep matching report paper. */
export function isVipTheme(themeId: string | undefined | null): boolean {
  return themeId === 'luxury' || themeId === 'ai'
}
