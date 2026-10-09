import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import { canTransferRegister, posPostedAccounts, transferFitsBalance } from '@/lib/pos-register-posting'

describe('posPostedAccounts', () => {
  const payments = [
    { accountId: 'wallet-cash', amount: '100', description: 'Cash' },
    { accountId: 'wallet-evc', amount: '20', description: 'EVC' },
  ]
  const change = { accountId: 'wallet-evc', amount: '13', description: 'Change · EVC' }

  it('posts the tender and the change to the register bank account', () => {
    const posted = posPostedAccounts({
      depositLedgerAccountId: 'till-bank',
      payments,
      change,
    })
    expect(posted.payments.map((row) => row.accountId)).toEqual(['till-bank', 'till-bank'])
    expect(posted.payments.map((row) => row.description)).toEqual(['Cash', 'EVC'])
    expect(posted.change).toEqual({ accountId: 'till-bank', amount: '13', description: 'Change · EVC' })
  })

  it('leaves older receipts on the wallet accounts they were posted to', () => {
    const posted = posPostedAccounts({
      depositLedgerAccountId: null,
      payments,
      change,
    })
    expect(posted.payments).toEqual(payments)
    expect(posted.change).toEqual(change)
  })
})

describe('canTransferRegister', () => {
  it('lets an admin move any register', () => {
    expect(
      canTransferRegister({
        canManage: true,
        canSell: false,
        staffUserIds: ['someone-else'],
        userId: 'admin',
      }),
    ).toBe(true)
  })

  it('lets an assigned salesman move only that register', () => {
    expect(
      canTransferRegister({
        canManage: false,
        canSell: true,
        staffUserIds: ['cashier'],
        userId: 'cashier',
      }),
    ).toBe(true)
    expect(
      canTransferRegister({
        canManage: false,
        canSell: true,
        staffUserIds: ['cashier'],
        userId: 'other',
      }),
    ).toBe(false)
  })

  it('lets any seller move a till that has no staff list', () => {
    expect(
      canTransferRegister({
        canManage: false,
        canSell: true,
        staffUserIds: [],
        userId: 'cashier',
      }),
    ).toBe(true)
  })
})

describe('transferFitsBalance', () => {
  it('accepts the balance and refuses more', () => {
    expect(transferFitsBalance(new Decimal('10'), new Decimal('10'))).toBe('ok')
    expect(transferFitsBalance(new Decimal('10.01'), new Decimal('10'))).toBe('over')
    expect(transferFitsBalance(new Decimal('1'), new Decimal('0'))).toBe('empty')
    expect(transferFitsBalance(new Decimal('0'), new Decimal('10'))).toBe('nonpositive')
  })
})
