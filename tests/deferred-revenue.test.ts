import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import { recognitionSlice, remainingUnearned } from '@/lib/erp/deferred-revenue'

describe('deferred revenue math', () => {
  it('splits evenly and puts remainder on the last month', () => {
    const total = new Decimal('100')
    const m0 = recognitionSlice(total, 3, 0, 0)
    const m1 = recognitionSlice(total, 3, 1, m0)
    const m2 = recognitionSlice(total, 3, 2, m0.plus(m1))
    expect(m0.toString()).toBe('33.3333')
    expect(m1.toString()).toBe('33.3333')
    expect(m2.toString()).toBe('33.3334')
    expect(m0.plus(m1).plus(m2).toString()).toBe('100')
  })

  it('returns zero when fully recognized', () => {
    expect(recognitionSlice(100, 12, 11, 100).toString()).toBe('0')
    expect(remainingUnearned(100, 100).toString()).toBe('0')
    expect(remainingUnearned(100, 40).toString()).toBe('60')
  })
})
