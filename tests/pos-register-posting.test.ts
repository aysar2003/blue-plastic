import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import {
  canTransferRegister,
  canUseRegister,
  posPostedAccounts,
  transferFitsBalance,
} from '@/lib/pos-register-posting'

describe('posPostedAccounts', () => {
  const payments = [
    { accountId: 'wallet-cash', amount: '100', description: 'Cash' },
    { accountId: 'wallet-evc', amount: '20', description: 'EVC' },
  ]
  const change = { accountId: 'wallet-evc', amount: '13', description: 'Change · EVC' }

  it('posts every tender to the register bank when a till deposit account is set', () => {
    const posted = posPostedAccounts({
      depositLedgerAccountId: 'till-bank',
      payments: [
        { accountId: 'wallet-cash', amount: '100', description: 'Cash', isCash: true },
        { accountId: 'wallet-evc', amount: '20', description: 'EVC', isCash: false },
      ],
      change: { accountId: 'wallet-evc', amount: '13', description: 'Change · EVC', isCash: false },
    })
    expect(posted.payments.map((row) => row.accountId)).toEqual(['till-bank', 'till-bank'])
    expect(posted.change).toEqual({
      accountId: 'till-bank',
      amount: '13',
      description: 'Change · EVC',
      isCash: false,
    })
  })

  it('rewrites unmarked tenders onto the till bank too', () => {
    const posted = posPostedAccounts({
      depositLedgerAccountId: 'till-bank',
      payments,
      change,
    })
    expect(posted.payments.map((row) => row.accountId)).toEqual(['till-bank', 'till-bank'])
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

describe('canUseRegister', () => {
  it('lets an admin use any register', () => {
    expect(
      canUseRegister({
        canManage: true,
        staffUserIds: ['someone-else'],
        userId: 'admin',
      }),
    ).toBe(true)
  })

  it('lets an assigned cashier use only that register', () => {
    expect(
      canUseRegister({
        canManage: false,
        staffUserIds: ['cashier'],
        userId: 'cashier',
      }),
    ).toBe(true)
    expect(
      canUseRegister({
        canManage: false,
        staffUserIds: ['cashier'],
        userId: 'other',
      }),
    ).toBe(false)
  })

  it('blocks cashiers when the counter has no staff assigned', () => {
    expect(
      canUseRegister({
        canManage: false,
        staffUserIds: [],
        userId: 'cashier',
      }),
    ).toBe(false)
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

  it('blocks sellers when the till has no staff list', () => {
    expect(
      canTransferRegister({
        canManage: false,
        canSell: true,
        staffUserIds: [],
        userId: 'cashier',
      }),
    ).toBe(false)
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
