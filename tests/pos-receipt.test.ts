import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'

import { ThermalReceipt, type ThermalReceiptData } from '@/components/pos/thermal-receipt'
import { parseChange, parseReceiptPaper, paymentRows, pxToMm, receiptCashierName, trimQty } from '@/lib/pos-receipt'

describe('receipt helpers', () => {
  it('defaults to the 80mm roll and only accepts 80 or 58', () => {
    expect(parseReceiptPaper(null)).toBe('80')
    expect(parseReceiptPaper('58')).toBe('58')
    expect(parseReceiptPaper('A4')).toBe('80')
  })

  it('reads the change passed by the till, ignoring anything odd', () => {
    expect(parseChange('19')).toBe(19)
    expect(parseChange(['2.505'])).toBe(2.51)
    expect(parseChange('-5')).toBe(0)
    expect(parseChange('abc')).toBe(0)
    expect(parseChange(undefined)).toBe(0)
  })

  it('shows what the customer handed over on the cash line, and the change', () => {
    const payments = [
      { method: 'EVC Plus', amount: '100.0000', isCash: false },
      { method: 'Cash', amount: '81.0000', isCash: true },
    ]
    expect(paymentRows(payments, '181', 19)).toEqual({
      rows: [
        { label: 'EVC Plus', amount: 100 },
        { label: 'Cash', amount: 100 },
      ],
      paid: 200,
      change: 19,
    })
  })

  it('drops change when nothing was paid in cash, and reprints show what was recorded', () => {
    const card = [{ method: 'EVC Plus', amount: '40', isCash: false }]
    expect(paymentRows(card, '40', 5)).toEqual({ rows: [{ label: 'EVC Plus', amount: 40 }], paid: 40, change: 0 })
    expect(paymentRows([], '40', 0)).toEqual({ rows: [], paid: 40, change: 0 })
  })

  it('lists only methods that took money, and does not inflate cash by the whole total', () => {
    // $54 sale. Wallets took 53 and cash took the last dollar. No change.
    const payments = [
      { method: 'EDAHAB 88', amount: '10.00', isCash: false },
      { method: 'EDAHAB BLUE', amount: '20.00', isCash: false },
      { method: 'EVC 88', amount: '15.00', isCash: false },
      { method: 'EVC BLUE PLASTIC', amount: '8.00', isCash: false },
      { method: 'Cash', amount: '1.00', isCash: true },
      { method: 'MERCHANT BLUE PLASTIC', amount: '0.00', isCash: false },
    ]
    expect(paymentRows(payments, '54.00', 0)).toEqual({
      rows: [
        { label: 'EDAHAB 88', amount: 10 },
        { label: 'EDAHAB BLUE', amount: 20 },
        { label: 'EVC 88', amount: 15 },
        { label: 'EVC BLUE PLASTIC', amount: 8 },
        { label: 'Cash', amount: 1 },
      ],
      paid: 54,
      change: 0,
    })
  })

  it('shows the cash that was handed over when the customer overpays in cash', () => {
    const payments = [
      { method: 'EDAHAB 88', amount: '10.00', isCash: false },
      { method: 'EDAHAB BLUE', amount: '20.00', isCash: false },
      { method: 'EVC 88', amount: '15.00', isCash: false },
      { method: 'EVC BLUE PLASTIC', amount: '8.00', isCash: false },
      { method: 'Cash', amount: '1.00', isCash: true },
    ]
    expect(paymentRows(payments, '54.00', 4)).toEqual({
      rows: [
        { label: 'EDAHAB 88', amount: 10 },
        { label: 'EDAHAB BLUE', amount: 20 },
        { label: 'EVC 88', amount: 15 },
        { label: 'EVC BLUE PLASTIC', amount: 8 },
        { label: 'Cash', amount: 5 },
      ],
      paid: 58,
      change: 4,
    })
  })

  it('does not add change on top of a tender that was already stored in full', () => {
    const payments = [
      { method: 'Cash', amount: '100.00', isCash: true },
      { method: 'EVC 88', amount: '0', isCash: false },
    ]
    expect(paymentRows(payments, '87.00', 13, { tendered: true })).toEqual({
      rows: [{ label: 'Cash', amount: 100 }],
      paid: 100,
      change: 13,
    })
  })

  it('trims quantities and converts px to mm at 96dpi', () => {
    expect(trimQty('2.0000')).toBe('2')
    expect(trimQty('1.5000')).toBe('1.5')
    expect(pxToMm(96)).toBeCloseTo(25.4)
  })

  it('names the till person as cashier, not the signed-in account', () => {
    const admin = { name: 'abdisalam abdullahi mohamed', email: 'admin@shop.test' }
    expect(receiptCashierName('MOHAMED AHMED IIZE', admin)).toBe('MOHAMED AHMED IIZE')
    expect(receiptCashierName(null, admin)).toBe('abdisalam abdullahi mohamed')
    expect(receiptCashierName(null, { name: null, email: 'admin@shop.test' })).toBe('admin@shop.test')
    expect(receiptCashierName(null, null)).toBeNull()
  })
})

const receipt: ThermalReceiptData = {
  number: 'SR-1042',
  isVoid: false,
  currency: 'USD',
  createdAt: '2026-10-08T14:56:00.000Z',
  note: null,
  subtotal: '46.0000',
  discount: '0',
  tax: '0',
  total: '46.0000',
  registerName: 'Main till',
  cashierName: 'Fahad',
  customer: null,
  lines: [
    { id: 'l1', name: 'AASTO', quantity: '2.0000', unitPrice: '20.0000', discountPercent: null, amount: '40.0000' },
    { id: 'l2', name: 'A4', quantity: '1.0000', unitPrice: '6.0000', discountPercent: null, amount: '6.0000' },
  ],
  payments: [{ method: 'Cash', amount: '46.0000', isCash: true }],
}
const shop = {
  name: 'Blue Plastic Center',
  addressLines: ['Bakaara Market', 'Mogadishu'],
  phone: '+252 61 000 0000',
  taxRegistrationNumber: null,
  timeZone: 'Africa/Mogadishu',
}

function render(props: Partial<Parameters<typeof ThermalReceipt>[0]> = {}) {
  return renderToString(
    createElement(ThermalReceipt, { receipt, shop, change: 4, autoprint: false, creatorBrand: null, ...props }),
  ).replace(/<!-- -->/g, '')
}

describe('thermal receipt', () => {
  it('prints the slip in black on an 80mm roll by default', () => {
    const html = render()
    expect(html).toContain('data-paper="80"')
    expect(html).toContain('width:80mm')
    expect(html).toContain('BLUE PLASTIC CENTER')
    expect(html).toContain('Tel: +252 61 000 0000')
    expect(html).toContain('SR-1042')
    expect(html).toContain('08/10/2026 17:56') // shop time, not UTC
    expect(html).toContain('Salesman')
    expect(html).toContain('Fahad')
    expect(html).not.toContain('Cashier')
    expect(html).not.toContain('Register')
    expect(html).not.toContain('Main till')
    expect(html).toContain('2 x $20.00')
    expect(html).toContain('$46.00')
    expect(html).toMatch(/Cash<\/span><span[^>]*>\$50\.00/)
    expect(html).toMatch(/Change<\/span><span[^>]*>\$4\.00/)
    expect(html).toContain('Mahadsanid!')
    // The global print sheet hides header/nav/aside (app shell); the slip must not use them.
    expect(html).not.toMatch(/<(header|nav|aside|footer)[\s>]/)
    // Black only: no colour other than black and white on the slip itself.
    const slip = html.slice(html.indexOf('thermal-receipt'))
    expect(slip.match(/#[0-9a-f]{3,6}\b/gi)?.filter((c) => !/^#(000|000000|fff|ffffff)$/i.test(c)) ?? []).toEqual([])
  })

  it('honours the 58mm roll and the creator-brand switch', () => {
    const html = render({ initialPaper: '58', creatorBrand: 'Abdisalm Hero' })
    expect(html).toContain('width:58mm')
    expect(html).toContain('System: Abdisalm Hero')
    expect(render()).not.toContain('System:')
  })

  it('names a real customer and marks a void sale', () => {
    const html = render({ receipt: { ...receipt, isVoid: true, customer: { name: 'Hodan Ali', phone: null } } })
    expect(html).toContain('Hodan Ali')
    expect(html).toContain('VOID')
  })
})
