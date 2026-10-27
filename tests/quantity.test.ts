import { describe, expect, it } from 'vitest'

import { DEFAULT_UNIT, fixed2, formatQty, resolveUnit, trimQty } from '@/lib/quantity'

describe('quantity + unit', () => {
  it('defaults blank unit to Pcs', () => {
    expect(resolveUnit(null)).toBe(DEFAULT_UNIT)
    expect(resolveUnit('  ')).toBe(DEFAULT_UNIT)
    expect(resolveUnit('m')).toBe('m')
  })

  it('formats quantity with unit', () => {
    expect(formatQty('12.50', 'm')).toBe('12.50 m')
    expect(formatQty(3, null)).toBe('3.00 Pcs')
    expect(formatQty(10, 'pcs')).toBe('10.00 pcs')
    expect(formatQty('', 'kg')).toBe('')
  })

  it('keeps two decimal places on rates and amounts', () => {
    expect(fixed2('100')).toBe('100.00')
    expect(fixed2('10.5')).toBe('10.50')
    expect(fixed2('')).toBe('')
  })

  it('trims trailing zeros', () => {
    expect(trimQty('4.00')).toBe('4')
    expect(trimQty(2.25)).toBe('2.25')
  })
})
