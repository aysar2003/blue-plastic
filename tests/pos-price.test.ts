import { describe, expect, it } from 'vitest'

import { posUnitPrice } from '@/lib/pos-price'

describe('posUnitPrice', () => {
  const product = { price: '10.00', wholesalePrice: '7.50' }

  it('uses sales price for retail or walk-in', () => {
    expect(posUnitPrice(product, 'RETAIL')).toBe('10.00')
    expect(posUnitPrice(product, undefined)).toBe('10.00')
  })

  it('uses wholesale when the customer is wholesale and a wholesale price is set', () => {
    expect(posUnitPrice(product, 'WHOLESALE')).toBe('7.50')
  })

  it('falls back to sales price when wholesale is blank', () => {
    expect(posUnitPrice({ price: '10.00', wholesalePrice: null }, 'WHOLESALE')).toBe('10.00')
    expect(posUnitPrice({ price: '10.00', wholesalePrice: '' }, 'WHOLESALE')).toBe('10.00')
  })

  it('uses an active list price before wholesale, then applies promo %', () => {
    expect(posUnitPrice(product, 'WHOLESALE', '8.00')).toBe('8.00')
    expect(posUnitPrice({ ...product, promoPercent: 10 }, 'RETAIL')).toBe('9.00')
    expect(posUnitPrice({ ...product, promoPercent: 10 }, 'WHOLESALE', '8.00')).toBe('7.20')
  })
})
