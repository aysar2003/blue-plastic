import { describe, expect, it } from 'vitest'

import { readRegisterForm } from '@/lib/pos-register-form'
import { posRegisterSchema } from '@/lib/validation/pos'

const CUSTOMER = 'cmuvctycf000004jskg73qop4'
const STORE = 'cmuvhtspi000004l8epn6t8ww'
const CASH = 'cmuvaaaaa000004jskg73qop4'
const EVC = 'cmuvbbbbb000004jskg73qop4'
const REGISTER = 'cmuvccccc000004jskg73qop4'

function form(entries: [string, string][]) {
  const data = new FormData()
  for (const [key, value] of entries) data.append(key, value)
  return data
}

describe('readRegisterForm', () => {
  it('reads an edit with the till switched off (unchecked box is omitted)', () => {
    const input = readRegisterForm(
      form([
        ['id', REGISTER],
        ['name', '  MOHAMED AHMED IIZE  '],
        ['defaultCustomerId', CUSTOMER],
        ['storeId', STORE],
        ['paymentMethodIds', CASH],
        ['paymentMethodIds', EVC],
        ['paymentMethodIds', CASH],
      ]),
    )
    expect(input).toEqual({
      id: REGISTER,
      name: 'MOHAMED AHMED IIZE',
      defaultCustomerId: CUSTOMER,
      storeId: STORE,
      paymentMethodIds: [CASH, EVC],
      staffUserIds: [],
      isActive: false,
      pin: '',
      allowWalletChangeReturn: false,
      defaultChangeMethodId: '',
      changeMethodIds: undefined,
    })
    const parsed = posRegisterSchema.parse(input)
    expect(parsed.id).toBe(REGISTER)
    expect(parsed.isActive).toBe(false)
    expect(parsed.storeId).toBe(STORE)
    expect(parsed.pin).toBeUndefined()
    expect(parsed.staffUserIds).toEqual([])
  })

  it('reads an add (no id, office default store, active checked)', () => {
    const STAFF = 'cmuvddddd000004jskg73qop4'
    const input = readRegisterForm(
      form([
        ['id', ''],
        ['name', 'New till'],
        ['defaultCustomerId', CUSTOMER],
        ['storeId', ''],
        ['paymentMethodIds', CASH],
        ['paymentMethodIds', EVC],
        ['staffUserIds', STAFF],
        ['isActive', 'true'],
        ['changeReturnConfigured', 'true'],
        ['changeMethodIds', CASH],
        ['allowWalletChangeReturn', 'true'],
        ['defaultChangeMethodId', CASH],
      ]),
    )
    const parsed = posRegisterSchema.parse(input)
    expect(parsed.id).toBeUndefined()
    expect(parsed.storeId).toBeNull()
    expect(parsed.isActive).toBe(true)
    expect(parsed.paymentMethodIds).toEqual([CASH, EVC])
    expect(parsed.pin).toBeUndefined()
    expect(parsed.allowWalletChangeReturn).toBe(true)
    expect(parsed.defaultChangeMethodId).toBe(CASH)
    expect(parsed.changeMethodIds).toEqual([CASH])
    expect(parsed.staffUserIds).toEqual([STAFF])
  })

  it('accepts a letter-and-number PIN, including one longer than 4', () => {
    const short = posRegisterSchema.parse(
      readRegisterForm(
        form([
          ['name', 'New till'],
          ['defaultCustomerId', CUSTOMER],
          ['paymentMethodIds', CASH],
          ['isActive', 'true'],
          ['pin', '  Ab12  '],
        ]),
      ),
    )
    expect(short.pin).toBe('Ab12')

    const longer = posRegisterSchema.parse(
      readRegisterForm(
        form([
          ['name', 'New till'],
          ['defaultCustomerId', CUSTOMER],
          ['paymentMethodIds', CASH],
          ['pin', 'cashier19'],
        ]),
      ),
    )
    expect(longer.pin).toBe('cashier19')
  })

  it('rejects a PIN that is too short, has symbols, or contains a space', () => {
    for (const pin of ['abc', '12!', 'ab cd', 'a'.repeat(65)]) {
      const result = posRegisterSchema.safeParse(
        readRegisterForm(
          form([
            ['name', 'New till'],
            ['defaultCustomerId', CUSTOMER],
            ['paymentMethodIds', CASH],
            ['pin', pin],
          ]),
        ),
      )
      expect(result.success, pin).toBe(false)
    }
  })

  it('rejects a till without payment methods or name', () => {
    const input = readRegisterForm(form([['name', ' '], ['defaultCustomerId', CUSTOMER]]))
    const result = posRegisterSchema.safeParse(input)
    expect(result.success).toBe(false)
    const fields = result.success ? [] : result.error.issues.map((issue) => issue.path[0])
    expect(fields).toContain('paymentMethodIds')
    expect(fields).toContain('name')
  })
})
