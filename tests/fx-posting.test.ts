import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'

/** Document amounts × rate → base; foreign columns keep the entered currency. */
describe('FX posting conversion', () => {
  it('converts foreign debit to base at the rate', () => {
    const foreign = new Decimal('100.00')
    const rate = new Decimal('3.5')
    const base = foreign.times(rate).toDecimalPlaces(4)
    expect(base.toFixed(4)).toBe('350.0000')
  })

  it('treats rate 1 same-currency as no FX', () => {
    const baseCurrency: string = 'USD'
    const docCurrency: string = 'USD'
    const rate = new Decimal(1)
    const isFx = docCurrency !== baseCurrency || !rate.equals(1)
    expect(isFx).toBe(false)
  })

  it('flags FX when currency differs even at rate 1', () => {
    const baseCurrency: string = 'USD'
    const docCurrency: string = 'EUR'
    const isFx = docCurrency !== baseCurrency || !new Decimal(1).equals(1)
    expect(isFx).toBe(true)
  })
})
