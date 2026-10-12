import { describe, expect, it } from 'vitest'

import {
  filterAccountCodeInput,
  filterDateInput,
  filterDecimalInput,
  filterIntegerInput,
  filterPhoneInput,
  inferInputKind,
} from './input-guards'

describe('filterDecimalInput', () => {
  it('keeps digits and one radix point', () => {
    expect(filterDecimalInput('12.345')).toBe('12.345')
    expect(filterDecimalInput('12.345678')).toBe('12.34567')
  })

  it('strips letters and stray symbols', () => {
    expect(filterDecimalInput('12a.3b5')).toBe('12.35')
    expect(filterDecimalInput('$99.00')).toBe('99.00')
    expect(filterDecimalInput('10%')).toBe('10')
  })

  it('keeps arithmetic the money parser understands', () => {
    expect(filterDecimalInput('120-10')).toBe('120-10')
    expect(filterDecimalInput('(2*50)/4')).toBe('(2*50)/4')
  })

  it('drops thousands commas', () => {
    expect(filterDecimalInput('1,234.56')).toBe('1234.56')
  })
})

describe('filterIntegerInput', () => {
  it('keeps digits only', () => {
    expect(filterIntegerInput('12a3')).toBe('123')
    expect(filterIntegerInput('-40x')).toBe('-40')
  })
})

describe('filterAccountCodeInput', () => {
  it('keeps at most eight digits', () => {
    expect(filterAccountCodeInput('6100a')).toBe('6100')
    expect(filterAccountCodeInput('123456789')).toBe('12345678')
  })
})

describe('filterPhoneInput', () => {
  it('keeps dialable marks and refuses letters', () => {
    expect(filterPhoneInput('+252 61-778 5686')).toBe('+252 61-778 5686')
    expect(filterPhoneInput('call me 61abc')).toBe('  61')
  })
})

describe('filterDateInput', () => {
  it('keeps digits and date separators', () => {
    expect(filterDateInput('2026-10-12x')).toBe('2026-10-12')
    expect(filterDateInput('12/10/2026')).toBe('12/10/2026')
  })
})

describe('inferInputKind', () => {
  it('reads inputMode and field names', () => {
    expect(inferInputKind({ inputMode: 'decimal' })).toBe('decimal')
    expect(inferInputKind({ inputMode: 'numeric', name: 'code' })).toBe('account-code')
    expect(inferInputKind({ name: 'phone' })).toBe('phone')
    expect(inferInputKind({ inputKind: 'integer' })).toBe('integer')
  })
})
