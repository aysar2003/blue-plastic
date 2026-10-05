import { pick, type CsvRow } from '@/lib/csv'

/**
 * Values as QuickBooks Online and a spreadsheet actually write them.
 *
 * A QBO export is not our column names. Balances arrive as "$1,234.56", dates as
 * "01/15/2026" or "15/01/2026", countries as "Somalia", and item types as
 * "Non-inventory". These functions turn that into what the ledger schemas accept,
 * and say when they had to leave something out.
 */

export type DateOrder = 'MDY' | 'DMY'

/** QuickBooks in the Americas writes month-first. Everywhere else, day-first. */
export function dateOrderFor(timeZone: string): DateOrder {
  return timeZone.startsWith('America/') ? 'MDY' : 'DMY'
}

export function normaliseMoney(raw: string): { value: string; ok: boolean } {
  let text = raw.trim()
  if (!text) return { value: '', ok: true }

  let negative = false
  if (text.startsWith('(') && text.endsWith(')')) {
    negative = true
    text = text.slice(1, -1)
  }

  text = text.replace(/[^\d,.\-]/g, '')
  if (text.startsWith('-')) {
    negative = true
    text = text.slice(1)
  }
  if (!text) return { value: '', ok: false }

  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  if (lastComma !== -1 && lastDot !== -1) {
    text = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '')
  } else if (lastComma !== -1) {
    const parts = text.split(',')
    const tail = parts[parts.length - 1] ?? ''
    text = parts.length > 2 || tail.length === 3 ? text.replace(/,/g, '') : text.replace(',', '.')
  }

  if (!/^\d+(\.\d+)?$/.test(text)) return { value: '', ok: false }

  const [whole, fraction = ''] = text.split('.')
  const trimmed = fraction.slice(0, 4).replace(/0+$/, '')
  const value = trimmed ? `${whole}.${trimmed}` : whole
  return { value: negative ? `-${value}` : value, ok: true }
}

/** A calendar date as YYYY-MM-DD, or empty when the cell cannot be read. */
export function normaliseDate(raw: string, order: DateOrder): string {
  const text = raw.trim()
  if (!text) return ''

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const parts = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (!parts) return ''

  let first = Number(parts[1])
  let second = Number(parts[2])
  let year = Number(parts[3])
  if (year < 100) year += year >= 70 ? 1900 : 2000

  let month: number
  let day: number
  if (first > 12) {
    day = first
    month = second
  } else if (second > 12) {
    month = first
    day = second
  } else if (order === 'DMY') {
    day = first
    month = second
  } else {
    month = first
    day = second
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const COUNTRIES: Record<string, string> = {
  somalia: 'SO',
  somali: 'SO',
  kenya: 'KE',
  ethiopia: 'ET',
  djibouti: 'DJ',
  uganda: 'UG',
  tanzania: 'TZ',
  rwanda: 'RW',
  sudan: 'SD',
  egypt: 'EG',
  nigeria: 'NG',
  ghana: 'GH',
  'south africa': 'ZA',
  'united states': 'US',
  'united states of america': 'US',
  usa: 'US',
  america: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  britain: 'GB',
  'great britain': 'GB',
  england: 'GB',
  'united arab emirates': 'AE',
  uae: 'AE',
  dubai: 'AE',
  canada: 'CA',
  australia: 'AU',
  india: 'IN',
  pakistan: 'PK',
  china: 'CN',
  germany: 'DE',
  france: 'FR',
  netherlands: 'NL',
  saudi: 'SA',
  'saudi arabia': 'SA',
  qatar: 'QA',
  oman: 'OM',
  yemen: 'YE',
  turkey: 'TR',
  turkiye: 'TR',
}

export function normaliseCountry(raw: string): { code: string; warning?: string } {
  const text = raw.trim()
  if (!text) return { code: '' }
  if (/^[a-z]{2}$/i.test(text)) return { code: text.toUpperCase() }
  const code = COUNTRIES[text.toLowerCase()]
  if (code) return { code }
  return {
    code: '',
    warning: `Country "${text}" is not a 2-letter code, so it was left blank`,
  }
}

export function normaliseItemType(raw: string): 'SERVICE' | 'NON_INVENTORY' | 'INVENTORY' | 'SKIP' | '' {
  const text = raw.trim().toLowerCase().replace(/[^a-z]/g, '')
  if (!text) return ''
  if (text === 'service' || text === 'services') return 'SERVICE'
  if (text === 'inventory' || text === 'inventorypart' || text === 'stock') return 'INVENTORY'
  if (
    text === 'noninventory' ||
    text === 'noninventorypart' ||
    text === 'noninventoryitem' ||
    text === 'serviceitem'
  ) {
    return text === 'serviceitem' ? 'SERVICE' : 'NON_INVENTORY'
  }
  if (text === 'category' || text === 'bundle' || text === 'group') return 'SKIP'
  return ''
}

export function normaliseYes(raw: string, fallback: boolean): boolean {
  const text = raw.trim().toLowerCase()
  if (!text) return fallback
  if (['y', 'yes', 'true', '1', 'tax', 'taxable'].includes(text)) return true
  if (['n', 'no', 'false', '0', 'non', 'nontaxable', 'non-taxable'].includes(text)) return false
  return fallback
}

export type RowWarning = { field?: string; message: string }

export type ShapedContact = {
  skip?: string
  warnings: RowWarning[]
  inactive: boolean
  data?: Record<string, unknown>
}

function appendNote(notes: string, label: string, value: string): string {
  if (!value) return notes
  const line = `${label}: ${value}`
  return notes ? `${notes}\n${line}` : line
}

/**
 * One customer or vendor row, from our own export or from QuickBooks Online.
 * QuickBooks calls the same column Customer, Name, Supplier or Vendor.
 */
export function shapeContact(
  row: CsvRow,
  options: { paymentTermId: string; order: DateOrder },
): ShapedContact {
  const warnings: RowWarning[] = []
  const displayName = pick(
    row,
    'displayName',
    'display name',
    'customer',
    'vendor',
    'supplier',
    'name',
    'customer full name',
    'full name',
    'company name',
    'company',
  )
  if (!displayName) return { skip: 'No name in this row', warnings, inactive: false }

  const balanceRaw = pick(row, 'openingBalance', 'open balance', 'opening balance', 'balance', 'outstanding')
  const money = normaliseMoney(balanceRaw)
  let openingBalance = ''
  if (balanceRaw && !money.ok) {
    return { skip: `Open balance "${balanceRaw}" is not a number`, warnings, inactive: false }
  }
  // Signed: positive = owed the natural way; negative = credit already on the books.
  openingBalance = !money.value || money.value === '0' || money.value === '-0' ? '' : money.value

  const dateRaw = pick(row, 'openingBalanceDate', 'opening balance date', 'balance date', 'as of', 'as of date', 'date')
  const openingBalanceDate = normaliseDate(dateRaw, options.order)
  if (dateRaw && !openingBalanceDate) {
    warnings.push({
      field: 'openingBalanceDate',
      message: `Could not read the date "${dateRaw}", so the balance is dated today`,
    })
  }

  const country = normaliseCountry(pick(row, 'billingCountry', 'country', 'bill country', 'billing country'))
  if (country.warning) warnings.push({ field: 'country', message: country.warning })
  const shipCountry = normaliseCountry(pick(row, 'shippingCountry', 'ship country', 'shipping country'))
  if (shipCountry.warning) warnings.push({ field: 'shippingCountry', message: shipCountry.warning })

  const credit = normaliseMoney(pick(row, 'creditLimit', 'credit limit'))
  if (pick(row, 'creditLimit', 'credit limit') && !credit.ok) {
    warnings.push({ field: 'creditLimit', message: 'Credit limit was not a number, so it was left blank' })
  }

  let notes = pick(row, 'notes', 'note', 'comment')
  notes = appendNote(notes, 'Website', pick(row, 'website', 'web site', 'url'))
  notes = appendNote(notes, 'Account no.', pick(row, 'account no', 'account number', 'account no.'))
  const resale = pick(row, 'resale no', 'resale number')
  const tax = pick(row, 'taxRegistrationNumber', 'tax id', 'vat number', 'tin', 'tax reg no', 'tax registration number')
  if (resale && tax) notes = appendNote(notes, 'Resale no.', resale)

  const activeRaw = pick(row, 'active')
  const inactive = activeRaw !== '' && (!normaliseYes(activeRaw, true) || activeRaw.toLowerCase() === 'inactive')

  return {
    warnings,
    inactive,
    data: {
      displayName,
      companyName: pick(row, 'companyName', 'company', 'company name', 'organisation', 'organization'),
      firstName: pick(row, 'firstName', 'first', 'first name'),
      lastName: pick(row, 'lastName', 'last', 'surname', 'last name'),
      email: pick(row, 'email', 'email address', 'e-mail'),
      phone: pick(row, 'phone', 'telephone', 'tel', 'phone number', 'phone numbers'),
      mobile: pick(row, 'mobile', 'cell', 'mobile number'),
      taxRegistrationNumber: tax || resale,
      billingLine1: pick(
        row,
        'billingLine1',
        'address',
        'address1',
        'street',
        'street address',
        'bill street',
        'billing street',
        'billing address',
      ),
      billingLine2: pick(row, 'billingLine2', 'address2', 'bill street 2', 'address line 2'),
      billingCity: pick(row, 'billingCity', 'city', 'town', 'bill city', 'billing city'),
      billingRegion: pick(row, 'billingRegion', 'state', 'region', 'province', 'bill state', 'billing state'),
      billingPostalCode: pick(row, 'billingPostalCode', 'postal code', 'zip', 'postcode', 'bill zip', 'billing zip'),
      billingCountry: country.code,
      paymentTermId: options.paymentTermId,
      notes,
      creditLimit: credit.ok ? credit.value : '',
      openingBalance,
      openingBalanceDate,
      defaultExpenseAccountId: '',
      shippingLine1: pick(row, 'shippingLine1', 'shipping address', 'ship street', 'ship to'),
      shippingLine2: pick(row, 'shippingLine2', 'ship street 2'),
      shippingCity: pick(row, 'shippingCity', 'ship city'),
      shippingRegion: pick(row, 'shippingRegion', 'ship state', 'ship province'),
      shippingPostalCode: pick(row, 'shippingPostalCode', 'ship zip', 'ship postal code'),
      shippingCountry: shipCountry.code,
    },
  }
}

export type ItemKind = 'SERVICE' | 'NON_INVENTORY' | 'INVENTORY'

export type ShapedItem = {
  skip?: string
  warnings: RowWarning[]
  inactive: boolean
  draft?: {
    name: string
    sku: string
    type: ItemKind
    salesDescription: string
    salesPrice: string
    isTaxable: boolean
    incomeAccountName: string
    purchaseDescription: string
    purchaseCost: string
    expenseAccountName: string
    inventoryAccountName: string
    reorderPoint: string
    openingQuantity: string
    openingUnitCost: string
    openingDate: string
    /** Store name from the sheet — resolved to an id at import time. */
    storeName: string
  }
}

/** One product row, from our export or from a QuickBooks products-and-services file. */
export function shapeItem(row: CsvRow, order: DateOrder): ShapedItem {
  const warnings: RowWarning[] = []
  const rawName = pick(row, 'product/service name', 'product/service', 'item', 'name', 'product name')
  if (!rawName) return { skip: 'No product name in this row', warnings, inactive: false }

  const parts = rawName.split(':').map((part) => part.trim()).filter(Boolean)
  const name = parts[parts.length - 1] ?? rawName
  if (parts.length > 1) {
    warnings.push({
      field: 'name',
      message: `Imported as "${name}". QuickBooks category "${parts.slice(0, -1).join(': ')}" was not copied`,
    })
  }

  const typeRaw = pick(row, 'type')
  const kind = normaliseItemType(typeRaw)
  if (kind === 'SKIP') {
    return { skip: `"${typeRaw}" is a QuickBooks category or bundle, not a product`, warnings, inactive: false }
  }

  const priceRaw = pick(row, 'sales price', 'sales price/rate', 'sales price / rate', 'rate', 'price', 'unit price')
  const price = normaliseMoney(priceRaw)
  if (priceRaw && !price.ok) return { skip: `Sales price "${priceRaw}" is not a number`, warnings, inactive: false }

  const costRaw = pick(row, 'purchase cost', 'purchase price', 'cost')
  const cost = normaliseMoney(costRaw)
  if (costRaw && !cost.ok) return { skip: `Purchase cost "${costRaw}" is not a number`, warnings, inactive: false }

  const qtyRaw = pick(row, 'quantity on hand', 'qty on hand', 'quantity', 'qty')
  const qty = normaliseMoney(qtyRaw)
  if (qtyRaw && !qty.ok) return { skip: `Quantity "${qtyRaw}" is not a number`, warnings, inactive: false }

  const reorderRaw = pick(row, 'reorder point')
  const reorder = normaliseMoney(reorderRaw)
  if (reorderRaw && !reorder.ok) {
    warnings.push({ field: 'reorderPoint', message: 'Reorder point was not a number, so it was left blank' })
  }

  let type: ItemKind = kind === '' ? 'NON_INVENTORY' : kind
  let openingQuantity = ''
  let openingUnitCost = ''
  if (qty.value && qty.value !== '0' && !qty.value.startsWith('-')) {
    if (kind !== 'SERVICE' && kind !== 'INVENTORY') {
      warnings.push({
        field: 'type',
        message: 'Quantity on hand means this is an inventory product',
      })
    }
    type = kind === 'SERVICE' ? 'SERVICE' : 'INVENTORY'
    if (type === 'INVENTORY') {
      if (!cost.value) {
        warnings.push({
          field: 'openingQuantity',
          message: 'Quantity on hand was left out because there is no purchase cost to value it',
        })
      } else {
        openingQuantity = qty.value
        openingUnitCost = cost.value
      }
    }
  }

  const dateRaw = pick(row, 'quantity as-of date', 'quantity as of date', 'as of date', 'inv start date')
  const openingDate = normaliseDate(dateRaw, order)
  if (dateRaw && !openingDate) {
    warnings.push({ field: 'openingDate', message: `Could not read "${dateRaw}", so opening stock is dated today` })
  }

  const inactive = !normaliseYes(pick(row, 'active'), true)
  const storeName = pick(row, 'store', 'location', 'warehouse', 'site')

  return {
    warnings,
    inactive,
    draft: {
      name,
      sku: pick(row, 'sku'),
      type,
      salesDescription: pick(row, 'sales description', 'description', 'memo/description', 'memo'),
      salesPrice: price.value,
      isTaxable: normaliseYes(pick(row, 'taxable', 'tax'), true),
      incomeAccountName: pick(row, 'income account'),
      purchaseDescription: pick(row, 'purchase description'),
      purchaseCost: cost.value,
      expenseAccountName: pick(row, 'expense account', 'cogs account', 'cogs'),
      inventoryAccountName: pick(row, 'inventory asset account', 'inventory account', 'asset account'),
      reorderPoint: reorder.ok ? reorder.value : '',
      openingQuantity,
      openingUnitCost,
      openingDate,
      storeName,
    },
  }
}

export function looseKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Match a QuickBooks account name to a chart account. "Parent:Sales" matches "Sales". */
export function matchAccount(
  label: string,
  accounts: { id: string; name: string; code: string }[],
): string | undefined {
  const key = looseKey(label)
  if (!key) return undefined

  const exact = accounts.find((account) => looseKey(account.name) === key || looseKey(`${account.code} ${account.name}`) === key)
  if (exact) return exact.id

  const leaf = label.split(':').pop() ?? label
  if (looseKey(leaf) !== key) {
    return accounts.find((account) => looseKey(account.name) === looseKey(leaf))?.id
  }
  return undefined
}

/** Match a store name from the import sheet to an active store. */
export function matchStore(
  label: string,
  stores: { id: string; name: string; isOffice?: boolean }[],
): string | undefined {
  const key = looseKey(label)
  if (!key) return undefined
  const exact = stores.find((store) => looseKey(store.name) === key)
  if (exact) return exact.id
  // Common office aliases used on sheets.
  if (key === 'office' || key === 'xafiiska' || key === 'main') {
    return stores.find((store) => store.isOffice)?.id
  }
  return undefined
}

export { CONTACT_IMPORT_COLUMNS, ITEM_IMPORT_COLUMNS } from '@/lib/import-template'
