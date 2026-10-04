import { describe, expect, it } from 'vitest'

import { priceDocument } from './sales-pricing'
import type { TaxCodeShape } from './tax'

const vat16: TaxCodeShape = {
  id: 'vat',
  name: 'VAT 16%',
  isInclusive: false,
  components: [
    {
      taxRateId: 'vat-rate',
      name: 'VAT',
      rate: '0.16',
      sequence: 1,
      isCompound: false,
      salesAccountId: 'tax-payable',
      purchaseAccountId: null,
    },
  ],
}

const vat16Inclusive: TaxCodeShape = { ...vat16, id: 'vat-inc', isInclusive: true }

const codes = new Map([
  ['vat', vat16],
  ['vat-inc', vat16Inclusive],
])

describe('line arithmetic', () => {
  it('multiplies quantity by price', () => {
    const doc = priceDocument([{ quantity: '3', unitPrice: '12.50' }], codes, 'USD')
    expect(doc.subtotal.toString()).toBe('37.5')
    expect(doc.total.toString()).toBe('37.5')
  })

  it('takes the discount before tax, not after', () => {
    // 100 less 10% is 90; tax is 14.40, not 16.00 less something.
    const doc = priceDocument(
      [{ quantity: '1', unitPrice: '100', discountPercent: '10', taxCodeId: 'vat' }],
      codes,
      'USD',
    )
    expect(doc.subtotal.toString()).toBe('90')
    expect(doc.taxTotal.toString()).toBe('14.4')
    expect(doc.total.toString()).toBe('104.4')
    expect(doc.lineDiscountTotal.toString()).toBe('10')
  })

  it('rounds each line to the currency before summing', () => {
    const doc = priceDocument(
      [
        { quantity: '3', unitPrice: '0.3333' },
        { quantity: '3', unitPrice: '0.3333' },
      ],
      codes,
      'USD',
    )
    // 0.9999 rounds to 1.00 per line, so the document is 2.00 — not 1.9998.
    expect(doc.subtotal.toString()).toBe('2')
  })

  it('recognises the extracted net as revenue for an inclusive code', () => {
    // The customer pays 116; revenue is 100 and 16 is owed to the authority.
    const doc = priceDocument(
      [{ quantity: '1', unitPrice: '116', taxCodeId: 'vat-inc' }],
      codes,
      'USD',
    )
    expect(doc.subtotal.toString()).toBe('100')
    expect(doc.taxTotal.toString()).toBe('16')
    expect(doc.total.toString()).toBe('116')
  })

  it('leaves an untaxed line untaxed', () => {
    const doc = priceDocument([{ quantity: '2', unitPrice: '50' }], codes, 'USD')
    expect(doc.taxTotal.toString()).toBe('0')
    expect(doc.total.toString()).toBe('100')
  })

  it('groups tax by rate, ready to become one journal line each', () => {
    const doc = priceDocument(
      [
        { quantity: '1', unitPrice: '100', taxCodeId: 'vat' },
        { quantity: '1', unitPrice: '200', taxCodeId: 'vat' },
      ],
      codes,
      'USD',
    )
    expect(doc.taxByRate.get('vat-rate')?.amount.toString()).toBe('48')
    expect(doc.total.toString()).toBe('348')
  })

  it('takes a percent or an amount off the whole document before tax', () => {
    const percent = priceDocument(
      [{ quantity: '1', unitPrice: '100', taxCodeId: 'vat' }],
      codes,
      'USD',
      { kind: 'percent', value: '10' },
    )
    expect(percent.discountAmount.toString()).toBe('10')
    expect(percent.taxTotal.toString()).toBe('14.4')
    expect(percent.total.toString()).toBe('104.4')

    const amount = priceDocument(
      [{ quantity: '2', unitPrice: '40' }],
      codes,
      'USD',
      { kind: 'amount', value: '15' },
    )
    expect(amount.discountAmount.toString()).toBe('15')
    expect(amount.total.toString()).toBe('65')
  })

  it('always has total equal to subtotal plus tax', () => {
    for (const price of ['0.01', '7.77', '99.99', '1234.56']) {
      for (const code of [undefined, 'vat', 'vat-inc']) {
        const doc = priceDocument([{ quantity: '3', unitPrice: price, taxCodeId: code }], codes, 'USD')
        expect(
          doc.subtotal.plus(doc.taxTotal).toString(),
          `${price} / ${code ?? 'no tax'}`,
        ).toBe(doc.total.toString())
      }
    }
  })
})
