import { describe, expect, it } from 'vitest'

import { monthlyDepreciation } from '@/lib/fixed-asset-math'
import { Decimal } from '@/lib/money'

describe('monthlyDepreciation', () => {
  it('splits cost minus salvage over life', () => {
    const amount = monthlyDepreciation(new Decimal('12000'), new Decimal('0'), 60)
    expect(amount.toFixed(4)).toBe('200.0000')
  })

  it('returns zero when life is invalid', () => {
    expect(monthlyDepreciation(new Decimal('1000'), new Decimal('0'), 0).isZero()).toBe(true)
  })

  it('returns zero when salvage covers cost', () => {
    expect(monthlyDepreciation(new Decimal('100'), new Decimal('100'), 12).isZero()).toBe(true)
  })
})
