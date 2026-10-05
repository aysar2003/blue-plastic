import { describe, expect, it } from 'vitest'

import { parseCsv } from './csv'
import { CUSTOMER_TEMPLATE, ITEM_TEMPLATE, sampleRows, VENDOR_TEMPLATE } from './import-template'
import { matchAccount, normaliseDate, normaliseMoney, shapeContact, shapeItem } from './spreadsheet'

describe('QuickBooks values', () => {
  it('reads money the way an export writes it', () => {
    expect(normaliseMoney('$1,234.50').value).toBe('1234.5')
    expect(normaliseMoney('1.234,50').value).toBe('1234.5')
    expect(normaliseMoney('(25.00)').value).toBe('-25')
    expect(normaliseMoney('').ok).toBe(true)
  })

  it('reads both date orders, and does not guess when the day is past 12', () => {
    expect(normaliseDate('2026-01-15', 'MDY')).toBe('2026-01-15')
    expect(normaliseDate('15/01/2026', 'MDY')).toBe('2026-01-15')
    expect(normaliseDate('01/15/2026', 'DMY')).toBe('2026-01-15')
    expect(normaliseDate('02/03/2026', 'DMY')).toBe('2026-03-02')
    expect(normaliseDate('02/03/2026', 'MDY')).toBe('2026-02-03')
  })

  it('keeps a negative open balance so a credit posts on import', () => {
    const { rows } = parseCsv(
      [
        'Customer,Open Balance',
        'Credit Holder,-1200',
        'Also Parentheses,"(1,200.00)"',
      ].join('\n'),
    )

    expect(shapeContact(rows[0], { paymentTermId: '', order: 'DMY' }).data).toMatchObject({
      displayName: 'Credit Holder',
      openingBalance: '-1200',
    })
    expect(shapeContact(rows[1], { paymentTermId: '', order: 'DMY' }).data).toMatchObject({
      displayName: 'Also Parentheses',
      openingBalance: '-1200',
    })
  })

  it('maps a QuickBooks customer row, including the open balance and the country', () => {
    const { rows } = parseCsv(
      [
        'Blue Plastic Center',
        'Customer,Company name,Email,Phone,Bill street,Bill city,Bill state,Bill zip,Bill country,Open Balance,Terms',
        'Hodan Trading,Hodan Ltd,hodan@example.com,555-0100,Via Roma,Mogadishu,Banadir,001,Somalia,"$4,500.00",Net 30',
      ].join('\n'),
    )

    const shaped = shapeContact(rows[0], { paymentTermId: 'term_1', order: 'DMY' })
    expect(shaped.skip).toBeUndefined()
    expect(shaped.data).toMatchObject({
      displayName: 'Hodan Trading',
      companyName: 'Hodan Ltd',
      email: 'hodan@example.com',
      phone: '555-0100',
      billingLine1: 'Via Roma',
      billingCity: 'Mogadishu',
      billingRegion: 'Banadir',
      billingPostalCode: '001',
      billingCountry: 'SO',
      openingBalance: '4500',
      paymentTermId: 'term_1',
    })
  })

  it('maps a QuickBooks product row and values the quantity from the purchase cost', () => {
    const { rows } = parseCsv(
      [
        'Product/Service Name,SKU,Type,Sales Description,Sales Price / Rate,Purchase Cost,Quantity on hand,Income Account,Expense Account,Inventory Asset Account,Taxable',
        'Blue drum,DRM-1,Inventory,20L drum,25.00,12.50,40,Sales of Product Income,Cost of Goods Sold,Inventory Asset,Yes',
      ].join('\n'),
    )

    const shaped = shapeItem(rows[0], 'DMY')
    expect(shaped.draft).toMatchObject({
      name: 'Blue drum',
      sku: 'DRM-1',
      type: 'INVENTORY',
      salesDescription: '20L drum',
      salesPrice: '25',
      purchaseCost: '12.5',
      openingQuantity: '40',
      openingUnitCost: '12.5',
      incomeAccountName: 'Sales of Product Income',
      expenseAccountName: 'Cost of Goods Sold',
      inventoryAccountName: 'Inventory Asset',
      isTaxable: true,
    })
  })

  it('matches an account by name, or by the last part of a QuickBooks subaccount', () => {
    const accounts = [
      { id: 'sales', name: 'Sales', code: '4000' },
      { id: 'stock', name: 'Inventory Asset', code: '1300' },
    ]
    expect(matchAccount('sales', accounts)).toBe('sales')
    expect(matchAccount('4000 Sales', accounts)).toBe('sales')
    expect(matchAccount('Income:Inventory Asset', accounts)).toBe('stock')
    expect(matchAccount('Something else', accounts)).toBeUndefined()
  })
})

describe('blank sheet', () => {
  function filled(columns: { header: string; example: string }[]) {
    return parseCsv([columns.map((column) => column.header).join(','), columns.map((column) => column.example).join(',')].join('\n'))
      .rows[0]
  }

  it('reads a customer row written under the template headings', () => {
    const shaped = shapeContact(filled(CUSTOMER_TEMPLATE), { paymentTermId: 'term_1', order: 'DMY' })
    expect(shaped.data).toMatchObject({
      displayName: 'Hodan Trading',
      companyName: 'Hodan Ltd',
      email: 'hodan@example.com',
      billingLine1: 'Via Roma',
      billingCity: 'Mogadishu',
      billingCountry: 'SO',
      creditLimit: '5000',
      openingBalance: '4500',
      openingBalanceDate: '2026-10-01',
    })
  })

  it('reads a product row written under the template headings', () => {
    const shaped = shapeItem(filled(ITEM_TEMPLATE), 'DMY')
    expect(shaped.draft).toMatchObject({
      name: 'Blue drum',
      sku: 'DRM-1',
      type: 'INVENTORY',
      salesPrice: '25',
      purchaseCost: '12.5',
      openingQuantity: '40',
      openingUnitCost: '12.5',
      openingDate: '2026-10-01',
      isTaxable: true,
    })
  })

  it('gives the sample three rows, and only the required name is needed', () => {
    const rows = sampleRows('customer')
    expect(rows).toHaveLength(3)
    const headers = CUSTOMER_TEMPLATE.map((column) => column.header)
    const filled = (values: string[]) =>
      Object.fromEntries(headers.map((header, index) => [header.toLowerCase().replace(/[^a-z0-9]/g, ''), values[index] ?? '']))

    const first = shapeContact(filled(rows[0]!), { paymentTermId: '', order: 'DMY' })
    expect(first.data).toMatchObject({
      displayName: 'Hodan Trading',
      billingCountry: 'SO',
      openingBalance: '4500',
    })

    const sparse = shapeContact(filled(rows[1]!), { paymentTermId: '', order: 'DMY' })
    expect(sparse.data).toMatchObject({ displayName: 'Amina Shop', email: '', openingBalance: '' })
    expect(sampleRows('item')).toHaveLength(3)
    expect(sampleRows('vendor')).toHaveLength(3)
  })

  it('does not ask a vendor sheet for a credit limit', () => {
    expect(VENDOR_TEMPLATE.some((column) => column.header === 'Credit limit')).toBe(false)
    expect(CUSTOMER_TEMPLATE.some((column) => column.header === 'Credit limit')).toBe(true)
  })
})
