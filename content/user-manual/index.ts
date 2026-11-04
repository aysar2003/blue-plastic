/**
 * SOM ERP user manual — shared table of contents.
 *
 * Chapter bodies live in `chapters/*.ts` (EN + SO). Help pages and the printable
 * books in `docs/user-manual/` both read from here so they cannot drift apart.
 */

export type ManualAudience = 'staff' | 'accountant' | 'admin' | 'everyone'

export type ManualChapterMeta = {
  id: string
  /** Filename stem under content/user-manual/chapters/ */
  file: string
  order: number
  titleEn: string
  titleSo: string
  audience: ManualAudience
  /** In-app deep link when the chapter is mostly about one screen */
  href?: string
}

export const MANUAL_CHAPTERS: ManualChapterMeta[] = [
  {
    id: 'intro',
    file: '01-intro',
    order: 1,
    titleEn: 'Getting around',
    titleSo: 'Sida loo dhexmiro',
    audience: 'everyone',
  },
  {
    id: 'setup',
    file: '02-setup',
    order: 2,
    titleEn: 'Setting up the company',
    titleSo: 'Dejinta shirkadda',
    audience: 'admin',
    href: '/settings/organization',
  },
  {
    id: 'sales',
    file: '03-sales',
    order: 3,
    titleEn: 'Sales — invoice to cash',
    titleSo: 'Iib — invoice ilaa lacagta',
    audience: 'staff',
    href: '/sales/invoices',
  },
  {
    id: 'purchases',
    file: '04-purchases',
    order: 4,
    titleEn: 'Purchases — bills and expenses',
    titleSo: 'Iibsi — biilal iyo kharashyo',
    audience: 'staff',
    href: '/purchases/bills',
  },
  {
    id: 'inventory',
    file: '05-inventory',
    order: 5,
    titleEn: 'Inventory, store, and barcodes',
    titleSo: 'Kaydka, store, iyo barcodes',
    audience: 'staff',
    href: '/inventory/stock',
  },
  {
    id: 'banking',
    file: '06-banking',
    order: 6,
    titleEn: 'Banking and deposits',
    titleSo: 'Bangiga iyo deposits',
    audience: 'accountant',
    href: '/banking/accounts',
  },
  {
    id: 'pos',
    file: '07-pos',
    order: 7,
    titleEn: 'Point of Sale',
    titleSo: 'Point of Sale (POS)',
    audience: 'staff',
    href: '/pos',
  },
  {
    id: 'accounting',
    file: '08-accounting',
    order: 8,
    titleEn: 'Journals, delete, and reverse',
    titleSo: 'Journals, delete, iyo reverse',
    audience: 'accountant',
    href: '/journals',
  },
  {
    id: 'periods',
    file: '09-periods',
    order: 9,
    titleEn: 'Month-end and year-end',
    titleSo: 'Dhamaadka bisha iyo sannadka',
    audience: 'accountant',
    href: '/periods',
  },
  {
    id: 'reports',
    file: '10-reports',
    order: 10,
    titleEn: 'Reports you should trust first',
    titleSo: 'Warbaahinta ugu horreysa ee la aamino',
    audience: 'accountant',
    href: '/reports',
  },
  {
    id: 'hr',
    file: '11-hr',
    order: 11,
    titleEn: 'Employees, leave, attendance, payroll',
    titleSo: 'Shaqaalaha, fasax, attendance, payroll',
    audience: 'staff',
    href: '/employees',
  },
  {
    id: 'more',
    file: '12-more',
    order: 12,
    titleEn: 'Approvals, projects, and documents',
    titleSo: 'Approvals, projects, iyo documents',
    audience: 'everyone',
  },
  {
    id: 'trash',
    file: '13-trash',
    order: 13,
    titleEn: 'Trash and what you cannot change',
    titleSo: 'Trash iyo waxa aan la beddeli karin',
    audience: 'everyone',
    href: '/settings/trash',
  },
  {
    id: 'obstacles',
    file: '14-obstacles',
    order: 14,
    titleEn: 'Common obstacles',
    titleSo: 'Caqabadaha caadiga ah',
    audience: 'everyone',
  },
  {
    id: 'sme-depth',
    file: '15-sme-depth',
    order: 15,
    titleEn: 'SME depth — assets, equity, HR, collab',
    titleSo: 'Heerka SME — assets, equity, HR, collab',
    audience: 'accountant',
    href: '/accounting/fixed-assets',
  },
]

export type ManualLang = 'en' | 'so'

export function chapterTitle(meta: ManualChapterMeta, lang: ManualLang): string {
  return lang === 'so' ? meta.titleSo : meta.titleEn
}
