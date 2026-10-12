/**
 * Catalog of every paper / form layout the books expose.
 * Settings → Templates uses this so staff can find, pick, and manage them
 * in one place — including slots for templates you add yourself later.
 */

export type SystemTemplateKind =
  | 'document'
  | 'invoice-form'
  | 'sales-receipt-form'
  | 'sales-form'
  | 'report-paper'
  | 'report-sheet'
  | 'pos-receipt'
  | 'import-sheets'
  | 'my-templates'
  | 'branding'
  | 'appearance'

export type SystemTemplateEntry = {
  id: SystemTemplateKind
  label: string
  blurb: string
  /** Where the choice lives when it is not edited on this page. */
  href?: string
  hrefLabel?: string
  /** Editable on Settings → Templates (not just a link out). */
  managedHere: boolean
}

export const SYSTEM_TEMPLATES: SystemTemplateEntry[] = [
  {
    id: 'document',
    label: 'Invoice & statement paper',
    blurb: 'Colour, bank lines, terms, and Classic paper for invoices and statements.',
    managedHere: true,
  },
  {
    id: 'invoice-form',
    label: 'Invoice form layout',
    blurb: 'Sheet, Office, Classic, Service, or Modern when entering invoices and quotes.',
    managedHere: true,
  },
  {
    id: 'sales-receipt-form',
    label: 'Sales receipt form',
    blurb: 'Layout for counter and office sales receipts.',
    managedHere: true,
  },
  {
    id: 'sales-form',
    label: 'Other sales forms',
    blurb: 'Default layout for estimates, orders, credit memos, and refunds.',
    managedHere: true,
  },
  {
    id: 'report-paper',
    label: 'Report paper style',
    blurb: 'SOM ERP, QuickBooks, or Odoo banding on P&L and other reports.',
    managedHere: true,
  },
  {
    id: 'report-sheet',
    label: 'Report & chart density',
    blurb: 'Standard, Compact, or Plain rows on reports and the chart of accounts.',
    managedHere: true,
  },
  {
    id: 'pos-receipt',
    label: 'POS thermal receipt',
    blurb: 'Roll width for the till printer — 80 mm or 58 mm.',
    managedHere: true,
  },
  {
    id: 'import-sheets',
    label: 'Import spreadsheets',
    blurb: 'Blank Excel/CSV templates for customers, vendors, and products.',
    managedHere: true,
  },
  {
    id: 'my-templates',
    label: 'My templates',
    blurb: 'Templates you add yourself — upload, name, pick, and reuse later.',
    managedHere: true,
  },
  {
    id: 'branding',
    label: 'Company letterhead',
    blurb: 'Logo, brand mark, name, and address printed on every paper.',
    href: '/settings/organization',
    hrefLabel: 'Open Organisation',
    managedHere: false,
  },
  {
    id: 'appearance',
    label: 'System & website look',
    blurb: 'Desk theme, public website colours, and fonts.',
    href: '/settings/appearance',
    hrefLabel: 'Open Appearance',
    managedHere: false,
  },
]

export const DEFAULT_SYSTEM_TEMPLATE: SystemTemplateKind = 'document'
