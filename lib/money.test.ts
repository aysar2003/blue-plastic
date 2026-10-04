import { describe, expect, it } from 'vitest'

import {
  allocate,
  Decimal,
  formatMoney,
  formatSigned,
  minorUnits,
  parseMoneyInput,
  settleNumberInput,
  round,
  roundToCurrency,
  sum,
  toMoneyString,
} from './money'

describe('rounding', () => {
  it('rounds half away from zero, not to even', () => {
    // Banker's rounding would give 2.66 here. An invoice may not.
    expect(round('2.665', 2).toString()).toBe('2.67')
    expect(round('2.675', 2).toString()).toBe('2.68')
    expect(round('-2.665', 2).toString()).toBe('-2.67')
  })

  it('rounds to the currency minor unit', () => {
    expect(roundToCurrency('10.005', 'USD').toString()).toBe('10.01')
    expect(roundToCurrency('10.5', 'JPY').toString()).toBe('11')
    expect(roundToCurrency('10.0005', 'KWD').toString()).toBe('10.001')
  })

  it('knows minor units, defaulting to 2 for unknown codes', () => {
    expect(minorUnits('usd')).toBe(2)
    expect(minorUnits('JPY')).toBe(0)
    expect(minorUnits('BHD')).toBe(3)
    expect(minorUnits('XYZ')).toBe(2)
  })
})

describe('exactness', () => {
  it('does not accumulate binary floating point error', () => {
    // 0.1 + 0.2 !== 0.3 in IEEE 754. It must here.
    expect(sum(['0.1', '0.2']).equals(new Decimal('0.3'))).toBe(true)
  })

  it('sums a long run of cents exactly', () => {
    const values = Array.from({ length: 1000 }, () => '0.01')
    expect(sum(values).toString()).toBe('10')
  })

  it('serialises without exponential notation', () => {
    expect(toMoneyString('0.0001')).toBe('0.0001')
    expect(toMoneyString('1234567890.5')).toBe('1234567890.5000')
  })
})

describe('parseMoneyInput', () => {
  it('accepts the shapes users actually type', () => {
    expect(parseMoneyInput('1,234.56')?.toString()).toBe('1234.56')
    expect(parseMoneyInput('$ 99.00')?.toString()).toBe('99')
    expect(parseMoneyInput('-40')?.toString()).toBe('-40')
    expect(parseMoneyInput(' 12 ')?.toString()).toBe('12')
  })

  it('rejects rather than guesses', () => {
    expect(parseMoneyInput('abc')).toBeNull()
    expect(parseMoneyInput('1.2.3')).toBeNull()
    expect(parseMoneyInput('')).toBeNull()
    expect(parseMoneyInput('1e5')).toBeNull()
    expect(parseMoneyInput('120-')).toBeNull()
    expect(parseMoneyInput('10/0')).toBeNull()
  })

  it('adds, subtracts, multiplies and divides', () => {
    expect(parseMoneyInput('120-10')?.toString()).toBe('110')
    expect(parseMoneyInput('10+5')?.toString()).toBe('15')
    expect(parseMoneyInput('2*50')?.toString()).toBe('100')
    expect(parseMoneyInput('100/4')?.toString()).toBe('25')
    expect(parseMoneyInput('10+5*2')?.toString()).toBe('20')
    expect(parseMoneyInput('(120-10)/2')?.toString()).toBe('55')
    expect(parseMoneyInput('1,200 - 10')?.toString()).toBe('1190')
    expect(settleNumberInput('120-10')).toBe('110')
    expect(settleNumberInput('10.50')).toBeNull()
  })
})

describe('allocate', () => {
  it('never loses or invents a cent', () => {
    const parts = allocate('100', ['1', '1', '1'])
    expect(parts.map(String)).toEqual(['33.33', '33.33', '33.34'])
    expect(sum(parts).toString()).toBe('100')
  })

  it('allocates by weight', () => {
    const parts = allocate('10', ['3', '7'])
    expect(parts.map(String)).toEqual(['3', '7'])
  })

  it('handles a zero total weight', () => {
    expect(allocate('50', ['0', '0']).map(String)).toEqual(['0', '0'])
  })

  it('puts the residue on the last line, and only there', () => {
    const parts = allocate('0.10', ['1', '1', '1'])
    expect(sum(parts).toString()).toBe('0.1')
    expect(parts.map(String)).toEqual(['0.03', '0.03', '0.04'])
  })
})

describe('formatting', () => {
  it('formats to the currency minor unit', () => {
    expect(formatMoney('1234.5', 'USD')).toBe('$1,234.50')
    expect(formatMoney('1234.5', 'JPY')).toBe('¥1,235')
  })

  it('shows negatives in accounting parentheses', () => {
    expect(formatSigned('-1234.5', 'USD')).toBe('($1,234.50)')
    expect(formatSigned('1234.5', 'USD')).toBe('$1,234.50')
  })
})
