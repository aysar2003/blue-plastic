import { describe, expect, it } from 'vitest'

import { DEFAULT_UNIT, formatQty, resolveUnit, trimQty } from '@/lib/quantity'

describe('quantity + unit', () => {
  it('defaults blank unit to Pcs', () => {
    expect(resolveUnit(null)).toBe(DEFAULT_UNIT)
    expect(resolveUnit('  ')).toBe(DEFAULT_UNIT)
    expect(resolveUnit('m')).toBe('m')
  })

  it('formats quantity with unit', () => {
    expect(formatQty('12.50', 'm')).toBe('12.5 m')
    expect(formatQty(3, null)).toBe('3 Pcs')
    expect(formatQty('', 'kg')).toBe('')
  })

  it('trims trailing zeros', () => {
    expect(trimQty('4.00')).toBe('4')
    expect(trimQty(2.25)).toBe('2.25')
  })
})
