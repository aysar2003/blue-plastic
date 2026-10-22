/**
 * The paper every invoice and customer statement is drawn from.
 *
 * Stored as JSON on the organisation so the books can be restyled from
 * Settings without a new column for each line of the bill. A missing value
 * is the merchant paper: teal bands, bank lines, terms, and the older sheet
 * kept off until somebody turns it on.
 */

export type BankLine = {
  name: string
  account: string
}

/** Where the account block sits on an invoice or a bill. */
export const FOOTER_LAYOUTS = ['side', 'bottom', 'band'] as const
export type FooterLayout = (typeof FOOTER_LAYOUTS)[number]

export type DocumentTemplate = {
  /** Header and total bands. A CSS colour. */
  accent: string
  /** Vendor bills / purchase orders. Same family as the invoice, slightly different. */
  vendorAccent?: string
  banks: BankLine[]
  /** Heading above the account lines. Empty uses "Account". */
  footerTitle: string
  /** Extra lines under the accounts: branch, name on the account, a note. */
  footerNote: string
  /** side sits left of the totals, bottom is a full row, band is a coloured strip. */
  footerLayout: FooterLayout
  /** Terms printed under the totals. */
  terms: string
  /**
   * The older invoice sheet, renamed Classic paper. Off until somebody
   * turns the hidden button on in Settings → Templates.
   */
  showClassicPaper: boolean
}

/** Close to the invoice teal, shifted toward cyan so a vendor bill is obvious. */
export const DEFAULT_VENDOR_ACCENT = '#0e7490'

export const DEFAULT_DOCUMENT_TEMPLATE: DocumentTemplate = {
  accent: '#1eb8ae',
  vendorAccent: DEFAULT_VENDOR_ACCENT,
  banks: [],
  footerTitle: '',
  footerNote: '',
  footerLayout: 'side',
  terms: '',
  showClassicPaper: false,
}

const ACCENT = /^#[0-9a-fA-F]{6}$/

export function parseDocumentTemplate(raw: unknown): DocumentTemplate {
  const base: DocumentTemplate = {
    ...DEFAULT_DOCUMENT_TEMPLATE,
    banks: [],
  }
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Record<string, unknown>

  if (typeof data.accent === 'string' && ACCENT.test(data.accent)) base.accent = data.accent
  if (typeof data.vendorAccent === 'string' && ACCENT.test(data.vendorAccent)) {
    base.vendorAccent = data.vendorAccent
  }
  if (typeof data.terms === 'string') base.terms = data.terms.slice(0, 2000)
  if (typeof data.footerTitle === 'string') base.footerTitle = data.footerTitle.trim().slice(0, 80)
  if (typeof data.footerNote === 'string') base.footerNote = data.footerNote.slice(0, 2000)
  if (FOOTER_LAYOUTS.includes(data.footerLayout as FooterLayout)) {
    base.footerLayout = data.footerLayout as FooterLayout
  }
  if (typeof data.showClassicPaper === 'boolean') base.showClassicPaper = data.showClassicPaper

  if (Array.isArray(data.banks)) {
    base.banks = data.banks.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const bank = row as Record<string, unknown>
      const name = typeof bank.name === 'string' ? bank.name.trim().slice(0, 80) : ''
      const account = typeof bank.account === 'string' ? bank.account.trim().slice(0, 64) : ''
      if (!name && !account) return []
      return [{ name, account }]
    }).slice(0, 6)
  }

  return base
}

/** A light wash of the accent, for alternating table rows. */
export function accentWash(accent: string): string {
  return `color-mix(in srgb, ${accent} 16%, white)`
}

/** Customer invoice colour, or the vendor colour when printing a bill. */
export function paperAccent(template: DocumentTemplate, side: 'customer' | 'vendor' = 'customer'): string {
  if (side === 'vendor') return template.vendorAccent || DEFAULT_VENDOR_ACCENT
  return template.accent
}
