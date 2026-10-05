/**
 * The blank sheet a person fills in, and the columns the importer reads back.
 *
 * One header is one field. The name on the sheet is the name the import matches,
 * so a file filled from the template lands in the right column without a mapping
 * step. QuickBooks exports still match through the same loose names.
 */

export type TemplateList =
  | 'yesno'
  | 'itemType'
  | 'country'
  | 'terms'
  | 'income'
  | 'expense'
  | 'inventory'
  | 'store'

export type TemplateColumn = {
  /** Exact header written on the sheet. */
  header: string
  required: boolean
  /** What to type in the cell, shown on the sheet and in the import dialog. */
  hint: string
  example: string
  /** Number or date formatting, or a dropdown. */
  entry?: 'money' | 'date' | TemplateList
}

const yesNo = 'Yes or No. Leave blank for the usual answer.'

const contactColumns = (side: 'customer' | 'vendor'): TemplateColumn[] => [
  {
    header: 'Display name',
    required: true,
    hint: `The name on the ${side} list and on documents. One row per ${side}.`,
    example: side === 'customer' ? 'Hodan Trading' : 'Port Supplier',
  },
  {
    header: 'Company name',
    required: false,
    hint: 'Legal or trading name, when it differs from the display name.',
    example: side === 'customer' ? 'Hodan Ltd' : 'Port Supplier Co',
  },
  { header: 'First name', required: false, hint: 'Given name.', example: 'Hodan' },
  { header: 'Last name', required: false, hint: 'Family name.', example: 'Ali' },
  { header: 'Email', required: false, hint: 'Email address.', example: 'hodan@example.com' },
  { header: 'Phone', required: false, hint: 'Phone number.', example: '555-0100' },
  { header: 'Mobile', required: false, hint: 'Mobile number.', example: '555-0199' },
  { header: 'Street', required: false, hint: 'Billing street.', example: 'Via Roma' },
  { header: 'City', required: false, hint: 'Billing city.', example: 'Mogadishu' },
  { header: 'State', required: false, hint: 'Region or state.', example: 'Banadir' },
  { header: 'Postal code', required: false, hint: 'Postal code.', example: '001' },
  {
    header: 'Country',
    required: false,
    hint: 'Country name or a 2-letter code. Somalia is accepted.',
    example: 'Somalia',
    entry: 'country',
  },
  {
    header: 'Payment terms',
    required: false,
    hint: 'Must match a payment term already set up. Leave blank to use none.',
    example: 'Net 30',
    entry: 'terms',
  },
  {
    header: 'Tax registration number',
    required: false,
    hint: 'VAT, TIN, or tax registration number.',
    example: '',
  },
  ...(side === 'customer'
    ? [
        {
          header: 'Credit limit',
          required: false,
          hint: 'A number. Leave blank for no limit.',
          example: '5000',
          entry: 'money' as const,
        },
      ]
    : []),
  {
    header: 'Open balance',
    required: false,
    hint:
      side === 'customer'
        ? 'What they owe you (positive), or a credit they already hold with you (negative, e.g. -1200). Both post to the ledger.'
        : 'What you owe them (positive), or a credit you already hold with them (negative, e.g. -1200). Both post to the ledger.',
    example: '4500',
    entry: 'money',
  },
  {
    header: 'Opening balance date',
    required: false,
    hint: 'The date that balance is as of. Use a date, or YYYY-MM-DD. Blank means today.',
    example: '2026-10-01',
    entry: 'date',
  },
  { header: 'Notes', required: false, hint: 'Anything else you want kept on the record.', example: '' },
  {
    header: 'Active',
    required: false,
    hint: `${yesNo} Blank means active.`,
    example: 'Yes',
    entry: 'yesno',
  },
]

export const CUSTOMER_TEMPLATE: TemplateColumn[] = contactColumns('customer')
export const VENDOR_TEMPLATE: TemplateColumn[] = contactColumns('vendor')

export const ITEM_TEMPLATE: TemplateColumn[] = [
  {
    header: 'Product/Service Name',
    required: true,
    hint: 'The name on sales and purchases. One row per product.',
    example: 'Blue drum',
  },
  { header: 'SKU', required: false, hint: 'Your code. It has to be unique.', example: 'DRM-1' },
  {
    header: 'Type',
    required: false,
    hint: 'Service, Non-inventory, or Inventory. A quantity on hand makes it Inventory.',
    example: 'Inventory',
    entry: 'itemType',
  },
  {
    header: 'Sales Description',
    required: false,
    hint: 'Text shown on the invoice line.',
    example: '20L drum',
  },
  { header: 'Sales Price', required: false, hint: 'The price you sell at.', example: '25', entry: 'money' },
  {
    header: 'Taxable',
    required: false,
    hint: `${yesNo} Blank means taxable.`,
    example: 'Yes',
    entry: 'yesno',
  },
  {
    header: 'Income Account',
    required: false,
    hint: 'The income account name, as it appears on the chart. Blank uses Uncategorised income.',
    example: '',
    entry: 'income',
  },
  { header: 'Purchase Description', required: false, hint: 'Text shown on the bill line.', example: '' },
  {
    header: 'Purchase Cost',
    required: false,
    hint: 'What you pay. This is also the cost used to value the quantity on hand.',
    example: '12.50',
    entry: 'money',
  },
  {
    header: 'Expense Account',
    required: false,
    hint: 'For an inventory item, the cost of goods sold account. Otherwise the expense account.',
    example: '',
    entry: 'expense',
  },
  {
    header: 'Quantity on hand',
    required: false,
    hint: 'Opening stock. It is posted only when Purchase Cost is filled in.',
    example: '40',
    entry: 'money',
  },
  {
    header: 'Store',
    required: false,
    hint: 'Which store holds the quantity on hand. Must match a store name already set up. Blank uses the office store when stock is imported.',
    example: 'Office',
    entry: 'store',
  },
  { header: 'Reorder Point', required: false, hint: 'The quantity at which you want to reorder.', example: '10', entry: 'money' },
  {
    header: 'Inventory Asset Account',
    required: false,
    hint: 'For an inventory item. Blank uses the inventory asset account.',
    example: '',
    entry: 'inventory',
  },
  {
    header: 'Quantity as-of date',
    required: false,
    hint: 'The date the quantity is as of. Blank means today.',
    example: '2026-10-01',
    entry: 'date',
  },
  {
    header: 'Active',
    required: false,
    hint: `${yesNo} Blank means active.`,
    example: 'Yes',
    entry: 'yesno',
  },
]

/** Country names the sheet offers. Each one is a name the importer already understands. */
export const COUNTRY_CHOICES = [
  'Somalia',
  'Kenya',
  'Ethiopia',
  'Djibouti',
  'Uganda',
  'Tanzania',
  'Rwanda',
  'Sudan',
  'Egypt',
  'Nigeria',
  'Ghana',
  'South Africa',
  'United States',
  'United Kingdom',
  'United Arab Emirates',
  'Canada',
  'Australia',
  'India',
  'Pakistan',
  'China',
  'Germany',
  'France',
  'Netherlands',
  'Saudi Arabia',
  'Qatar',
  'Oman',
  'Yemen',
  'Turkey',
]

export const ITEM_TYPE_CHOICES = ['Service', 'Non-inventory', 'Inventory']

export function templateFor(kind: 'customer' | 'vendor' | 'item'): TemplateColumn[] {
  if (kind === 'customer') return CUSTOMER_TEMPLATE
  if (kind === 'vendor') return VENDOR_TEMPLATE
  return ITEM_TEMPLATE
}

/** Column guide shown in the import dialog — the same headers as the blank sheet. */
export function dialogColumns(columns: TemplateColumn[]): { name: string; required: boolean; aliases: string }[] {
  return columns.map((column) => ({ name: column.header, required: column.required, aliases: column.hint }))
}

export const CONTACT_IMPORT_COLUMNS = dialogColumns(CUSTOMER_TEMPLATE)
export const ITEM_IMPORT_COLUMNS = dialogColumns(ITEM_TEMPLATE)

/**
 * Three finished rows for the sample file.
 *
 * The first row fills every column. The other two leave optional columns blank,
 * so a person can see that only the required heading has to be filled.
 */
export function sampleRows(kind: 'customer' | 'vendor' | 'item'): string[][] {
  const columns = templateFor(kind)
  const records = kind === 'item' ? ITEM_SAMPLES : kind === 'vendor' ? VENDOR_SAMPLES : CUSTOMER_SAMPLES
  return records.map((record) => columns.map((column) => record[column.header] ?? ''))
}

const CUSTOMER_SAMPLES: Record<string, string>[] = [
  {
    'Display name': 'Hodan Trading',
    'Company name': 'Hodan Ltd',
    'First name': 'Hodan',
    'Last name': 'Ali',
    Email: 'hodan@example.com',
    Phone: '555-0100',
    Mobile: '555-0199',
    Street: 'Via Roma',
    City: 'Mogadishu',
    State: 'Banadir',
    'Postal code': '001',
    Country: 'Somalia',
    'Payment terms': 'Net 30',
    'Tax registration number': 'TIN-100',
    'Credit limit': '5000',
    'Open balance': '4500',
    'Opening balance date': '2026-10-01',
    Notes: 'Pays by transfer',
    Active: 'Yes',
  },
  {
    'Display name': 'Amina Shop',
    Phone: '555-0142',
    City: 'Hargeisa',
    Country: 'Somalia',
    Active: 'Yes',
  },
  {
    'Display name': 'Blue Star Co',
    'Company name': 'Blue Star Co',
    Email: 'accounts@bluestar.example',
    'Open balance': '1200',
    'Opening balance date': '2026-10-01',
    Active: 'Yes',
  },
]

const VENDOR_SAMPLES: Record<string, string>[] = [
  {
    'Display name': 'Port Supplier',
    'Company name': 'Port Supplier Co',
    'First name': 'Hassan',
    'Last name': 'Omar',
    Email: 'hassan@port.example',
    Phone: '555-0200',
    Mobile: '555-0299',
    Street: 'Harbour Road',
    City: 'Berbera',
    State: 'Woqooyi Galbeed',
    'Postal code': '002',
    Country: 'Somalia',
    'Payment terms': 'Net 30',
    'Tax registration number': 'TIN-200',
    'Open balance': '800',
    'Opening balance date': '2026-10-01',
    Notes: 'Delivers weekly',
    Active: 'Yes',
  },
  {
    'Display name': 'City Plastics',
    Phone: '555-0210',
    City: 'Mogadishu',
    Active: 'Yes',
  },
  {
    'Display name': 'Gulf Resin',
    Email: 'sales@gulfresin.example',
    Country: 'United Arab Emirates',
    'Open balance': '300',
    Active: 'Yes',
  },
]

const ITEM_SAMPLES: Record<string, string>[] = [
  {
    'Product/Service Name': 'Blue drum',
    SKU: 'DRM-1',
    Type: 'Inventory',
    'Sales Description': '20L drum',
    'Sales Price': '25',
    Taxable: 'Yes',
    'Purchase Description': '20L drum, purchased',
    'Purchase Cost': '12.50',
    'Quantity on hand': '40',
    Store: 'Office',
    'Reorder Point': '10',
    'Quantity as-of date': '2026-10-01',
    Active: 'Yes',
  },
  {
    'Product/Service Name': 'Delivery',
    Type: 'Service',
    'Sales Description': 'Local delivery',
    'Sales Price': '15',
    Taxable: 'Yes',
    Active: 'Yes',
  },
  {
    'Product/Service Name': 'Printed cap',
    Type: 'Non-inventory',
    'Sales Price': '8',
    'Purchase Cost': '3',
    Active: 'Yes',
  },
]
