import { describe, expect, it } from 'vitest'

import {
  CHANGE_ACCOUNT_MESSAGE,
  CHANGE_NOT_ALLOWED_MESSAGE,
  COVER_DUE_MESSAGE,
  POSITIVE_PAYMENT_MESSAGE,
  WALLET_CHANGE_OFF_MESSAGE,
  accountTenderTotals,
  changeReturnChoices,
  drawerCashMovement,
  paymentCanValidate,
  resolvePosTender,
  saleChangeLabel,
  walletTenderTotals,
  type ChangeMethod,
} from '@/lib/pos-change'
import { NON_CASH_OVERPAY_MESSAGE } from '@/lib/pos-payment'

const methods: ChangeMethod[] = [
  { id: 'cash', name: 'Cash', isCash: true, allowsChangeReturn: true },
  { id: 'edahab', name: 'EDAHAB 88', isCash: false, allowsChangeReturn: true },
  { id: 'edahab-blue', name: 'EDAHAB BLUE', isCash: false, allowsChangeReturn: true },
  { id: 'evc', name: 'EVC 88', isCash: false, allowsChangeReturn: true },
  { id: 'evc-blue', name: 'EVC BLUE PLASTIC', isCash: false, allowsChangeReturn: true },
  { id: 'merchant', name: 'MERCHANT BLUE PLASTIC', isCash: false, allowsChangeReturn: true },
]

const wallets = ['edahab', 'edahab-blue', 'evc', 'evc-blue', 'merchant'] as const

describe('change return configuration', () => {
  it('lists every allowed account and opens on cash', () => {
    const choices = changeReturnChoices({ methods, allowWalletChangeReturn: true, defaultMethodId: null })
    expect(choices.options.map((option) => option.id)).toEqual(methods.map((method) => method.id))
    expect(choices.defaultId).toBe('cash')
  })

  it('uses the saved default when that account may still return change', () => {
    const choices = changeReturnChoices({
      methods,
      allowWalletChangeReturn: true,
      defaultMethodId: 'evc',
    })
    expect(choices.defaultId).toBe('evc')
  })

  it('hides wallets when change from wallets is off, and falls back to cash', () => {
    const choices = changeReturnChoices({
      methods,
      allowWalletChangeReturn: false,
      defaultMethodId: 'evc',
    })
    expect(choices.options.map((option) => option.id)).toEqual(['cash'])
    expect(choices.defaultId).toBe('cash')
  })

  it('hides an account the till or the method has not allowed', () => {
    const restricted = methods.map((method) =>
      method.id === 'merchant' || method.id === 'edahab-blue' ? { ...method, allowsChangeReturn: false } : method,
    )
    const choices = changeReturnChoices({
      methods: restricted,
      allowWalletChangeReturn: true,
      defaultMethodId: 'merchant',
    })
    expect(choices.options.map((option) => option.id)).not.toContain('merchant')
    expect(choices.options.map((option) => option.id)).not.toContain('edahab-blue')
    expect(choices.defaultId).toBe('cash')
  })

  it('leaves nothing selected when no account may return change', () => {
    const choices = changeReturnChoices({
      methods: methods.map((method) => ({ ...method, allowsChangeReturn: false })),
      allowWalletChangeReturn: true,
      defaultMethodId: 'cash',
    })
    expect(choices.options).toEqual([])
    expect(choices.defaultId).toBe('')
  })
})

describe('Validate', () => {
  const allowed = methods.map((method) => method.id)

  it('stays disabled while any validation error is showing', () => {
    expect(
      paymentCanValidate({
        canSettle: true,
        blockingError: NON_CASH_OVERPAY_MESSAGE,
        change: '0.00',
        changeMethodId: 'cash',
        allowedChangeMethodIds: allowed,
      }),
    ).toBe(false)
  })

  it('stays disabled when change is due and the return account is missing or not allowed', () => {
    expect(
      paymentCanValidate({
        canSettle: true,
        blockingError: null,
        change: '13.00',
        changeMethodId: '',
        allowedChangeMethodIds: allowed,
      }),
    ).toBe(false)
    expect(
      paymentCanValidate({
        canSettle: true,
        blockingError: CHANGE_ACCOUNT_MESSAGE,
        change: '13.00',
        changeMethodId: 'evc',
        allowedChangeMethodIds: ['cash'],
      }),
    ).toBe(false)
  })

  it('enables an exact tender and a cash overpay whose change account is allowed', () => {
    expect(
      paymentCanValidate({
        canSettle: true,
        blockingError: null,
        change: '0.00',
        changeMethodId: '',
        allowedChangeMethodIds: allowed,
      }),
    ).toBe(true)
    expect(
      paymentCanValidate({
        canSettle: true,
        blockingError: null,
        change: '13.00',
        changeMethodId: 'evc',
        allowedChangeMethodIds: allowed,
      }),
    ).toBe(true)
  })
})

describe('resolvePosTender', () => {
  const base = { due: '87.00', methods, allowWalletChangeReturn: true }

  it('takes an exact payment and does not require a change account', () => {
    const result = resolvePosTender({ ...base, payments: [{ paymentMethodId: 'evc', amount: '87.00' }] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tender.change).toBe('0.00')
    expect(result.tender.changeMethodId).toBeNull()
    expect(result.tender.tenders).toEqual([{ paymentMethodId: 'evc', amount: '87.00' }])
    expect(result.tender.payments).toEqual(result.tender.tenders)
  })

  it('keeps a cash overpay and returns the change from cash', () => {
    const result = resolvePosTender({
      ...base,
      payments: [{ paymentMethodId: 'cash', amount: '100' }],
      changeMethodId: 'cash',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tender.change).toBe('13.00')
    expect(result.tender.changeMethodId).toBe('cash')
    expect(result.tender.tenders).toEqual([{ paymentMethodId: 'cash', amount: '100.00' }])
    expect(result.tender.payments).toEqual([{ paymentMethodId: 'cash', amount: '87.00' }])
  })

  it('returns change from each wallet', () => {
    for (const wallet of wallets) {
      const result = resolvePosTender({
        ...base,
        payments: [{ paymentMethodId: 'cash', amount: '100.00' }],
        changeMethodId: wallet,
      })
      expect(result.ok, wallet).toBe(true)
      if (!result.ok) continue
      expect(result.tender.changeMethodId).toBe(wallet)
      expect(result.tender.change).toBe('13.00')
      expect(result.tender.tenders).toEqual([{ paymentMethodId: 'cash', amount: '100.00' }])
    }
  })

  it('lets change leave the wallet that was charged, and still balances to the sale', () => {
    const result = resolvePosTender({
      ...base,
      payments: [
        { paymentMethodId: 'evc', amount: '20' },
        { paymentMethodId: 'cash', amount: '100' },
      ],
      changeMethodId: 'evc',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tender.change).toBe('33.00')
    expect(result.tender.tenders).toEqual([
      { paymentMethodId: 'cash', amount: '100.00' },
      { paymentMethodId: 'evc', amount: '20.00' },
    ])
    const totals = accountTenderTotals([
      {
        payments: [
          { methodId: 'cash', methodName: 'Cash', accountId: 'acct-cash', amount: '100.00' },
          { methodId: 'evc', methodName: 'EVC 88', accountId: 'acct-evc', amount: '20.00' },
        ],
        changeAmount: result.tender.change,
        changeMethodId: 'evc',
        changeMethodName: 'EVC 88',
        changeAccountId: 'acct-evc',
      },
    ])
    expect(totals.find((row) => row.accountId === 'acct-cash')).toMatchObject({ net: '100.00' })
    expect(totals.find((row) => row.accountId === 'acct-evc')).toMatchObject({ net: '-13.00' })
    expect(totals.reduce((sum, row) => sum + Number(row.net), 0)).toBe(87)
  })

  it('accepts a split tender and puts the cash excess on the chosen account', () => {
    const result = resolvePosTender({
      ...base,
      payments: [
        { paymentMethodId: 'evc', amount: '20' },
        { paymentMethodId: 'cash', amount: '80' },
      ],
      changeMethodId: 'edahab',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tender.change).toBe('13.00')
    expect(result.tender.payments).toEqual([
      { paymentMethodId: 'cash', amount: '67.00' },
      { paymentMethodId: 'evc', amount: '20.00' },
    ])
    expect(result.tender.tenders).toEqual([
      { paymentMethodId: 'cash', amount: '80.00' },
      { paymentMethodId: 'evc', amount: '20.00' },
    ])
  })

  it('rejects a non-cash overpay, a short tender, negatives, and a missing change account', () => {
    const over = resolvePosTender({ ...base, payments: [{ paymentMethodId: 'evc', amount: '90' }] })
    expect(over).toEqual({ ok: false, message: NON_CASH_OVERPAY_MESSAGE })

    const splitOver = resolvePosTender({
      ...base,
      payments: [
        { paymentMethodId: 'evc', amount: '50' },
        { paymentMethodId: 'edahab', amount: '40' },
      ],
    })
    expect(splitOver).toEqual({ ok: false, message: NON_CASH_OVERPAY_MESSAGE })

    const short = resolvePosTender({ ...base, payments: [{ paymentMethodId: 'cash', amount: '10' }] })
    expect(short).toEqual({ ok: false, message: COVER_DUE_MESSAGE })

    const negative = resolvePosTender({
      ...base,
      payments: [{ paymentMethodId: 'cash', amount: '-5' }],
    })
    expect(negative).toEqual({ ok: false, message: POSITIVE_PAYMENT_MESSAGE })

    const missing = resolvePosTender({
      ...base,
      payments: [{ paymentMethodId: 'cash', amount: '100' }],
    })
    expect(missing).toEqual({ ok: false, message: CHANGE_ACCOUNT_MESSAGE })
  })

  it('rejects change from a wallet when the till has switched wallets off, and from an account that is not allowed', () => {
    const wallet = resolvePosTender({
      ...base,
      allowWalletChangeReturn: false,
      payments: [{ paymentMethodId: 'cash', amount: '100' }],
      changeMethodId: 'evc',
    })
    expect(wallet).toEqual({ ok: false, message: WALLET_CHANGE_OFF_MESSAGE })

    const cashStillOk = resolvePosTender({
      ...base,
      allowWalletChangeReturn: false,
      payments: [{ paymentMethodId: 'cash', amount: '100' }],
      changeMethodId: 'cash',
    })
    expect(cashStillOk.ok).toBe(true)

    const blocked = methods.map((method) =>
      method.id === 'evc' ? { ...method, allowsChangeReturn: false } : method,
    )
    const denied = resolvePosTender({
      ...base,
      methods: blocked,
      payments: [{ paymentMethodId: 'cash', amount: '100' }],
      changeMethodId: 'evc',
    })
    expect(denied).toEqual({ ok: false, message: CHANGE_NOT_ALLOWED_MESSAGE })
  })
})

describe('report totals by account', () => {
  it('keeps an older sale with no change account as net received', () => {
    const totals = accountTenderTotals([
      {
        payments: [
          { methodId: 'cash', methodName: 'Cash', accountId: 'acct-cash', amount: '87.00' },
        ],
        changeAmount: '0',
        changeMethodId: null,
        changeMethodName: null,
        changeAccountId: null,
      },
    ])
    expect(totals).toEqual([
      { accountId: 'acct-cash', methodName: 'Cash', tendered: '87.00', change: '0.00', net: '87.00' },
    ])
    expect(
      saleChangeLabel({
        payments: [],
        changeAmount: '0',
        changeMethodId: null,
        changeMethodName: null,
        changeAccountId: null,
      }),
    ).toBeNull()
  })

  it('shows change from cash on the sale and in the account total', () => {
    const sale = {
      payments: [{ methodId: 'cash', methodName: 'Cash', accountId: 'acct-cash', amount: '100.00' }],
      changeAmount: '13.00',
      changeMethodId: 'cash',
      changeMethodName: 'Cash',
      changeAccountId: 'acct-cash',
    }
    expect(saleChangeLabel(sale)).toBe('Cash 13.00')
    expect(accountTenderTotals([sale])).toEqual([
      { accountId: 'acct-cash', methodName: 'Cash', tendered: '100.00', change: '13.00', net: '87.00' },
    ])
  })

  it('breaks change out of each wallet and leaves the cash tender intact', () => {
    for (const wallet of wallets) {
      const method = methods.find((row) => row.id === wallet)!
      const totals = accountTenderTotals([
        {
          payments: [{ methodId: 'cash', methodName: 'Cash', accountId: 'acct-cash', amount: '100.00' }],
          changeAmount: '13.00',
          changeMethodId: wallet,
          changeMethodName: method.name,
          changeAccountId: `acct-${wallet}`,
        },
      ])
      const cash = totals.find((row) => row.accountId === 'acct-cash')
      const returned = totals.find((row) => row.accountId === `acct-${wallet}`)
      expect(cash).toMatchObject({ tendered: '100.00', change: '0.00', net: '100.00' })
      expect(returned).toMatchObject({ tendered: '0.00', change: '13.00', net: '-13.00' })
    }
  })

  it('nets a split tender across the accounts that took money and the one that gave change', () => {
    const totals = accountTenderTotals([
      {
        payments: [
          { methodId: 'cash', methodName: 'Cash', accountId: 'acct-cash', amount: '80.00' },
          { methodId: 'evc', methodName: 'EVC 88', accountId: 'acct-evc', amount: '20.00' },
        ],
        changeAmount: '13.00',
        changeMethodId: 'edahab',
        changeMethodName: 'EDAHAB 88',
        changeAccountId: 'acct-edahab',
      },
      {
        payments: [{ methodId: 'cash', methodName: 'Cash', accountId: 'acct-cash', amount: '40.00' }],
        changeAmount: '0',
        changeMethodId: null,
        changeMethodName: null,
        changeAccountId: null,
      },
    ])
    expect(totals).toEqual([
      { accountId: 'acct-cash', methodName: 'Cash', tendered: '120.00', change: '0.00', net: '120.00' },
      { accountId: 'acct-edahab', methodName: 'EDAHAB 88', tendered: '0.00', change: '13.00', net: '-13.00' },
      { accountId: 'acct-evc', methodName: 'EVC 88', tendered: '20.00', change: '0.00', net: '20.00' },
    ])
    const net = totals.reduce((sum, row) => sum + Number(row.net), 0)
    expect(net).toBe(127)
  })

  it('lists every wallet even when they share one bank account', () => {
    const bank = 'acct-bank'
    const byAccount = accountTenderTotals([
      {
        payments: [
          { methodId: 'edahab', methodName: 'EDAHAB BLUE', accountId: bank, amount: '50.00' },
          { methodId: 'evc', methodName: 'EVC 88', accountId: bank, amount: '30.00' },
          { methodId: 'cash', methodName: 'Cash', accountId: 'acct-cash', amount: '20.00' },
        ],
        changeAmount: '0',
        changeMethodId: null,
        changeMethodName: null,
        changeAccountId: null,
      },
    ])
    expect(byAccount).toHaveLength(2)

    const byWallet = walletTenderTotals([
      {
        payments: [
          { methodId: 'edahab', methodName: 'EDAHAB BLUE', accountId: bank, amount: '50.00' },
          { methodId: 'evc', methodName: 'EVC 88', accountId: bank, amount: '30.00' },
          { methodId: 'cash', methodName: 'Cash', accountId: 'acct-cash', amount: '20.00' },
        ],
        changeAmount: '0',
        changeMethodId: null,
        changeMethodName: null,
        changeAccountId: null,
      },
    ])
    expect(byWallet).toEqual([
      { methodId: 'cash', methodName: 'Cash', tendered: '20.00', change: '0.00', net: '20.00' },
      { methodId: 'edahab', methodName: 'EDAHAB BLUE', tendered: '50.00', change: '0.00', net: '50.00' },
      { methodId: 'evc', methodName: 'EVC 88', tendered: '30.00', change: '0.00', net: '30.00' },
    ])
  })
})

describe('drawer cash', () => {
  it('keeps only the net when change comes back out of the drawer', () => {
    expect(
      drawerCashMovement({
        kind: 'SALE',
        payments: [{ isCash: true, amount: '100' }],
        changeAmount: '13',
        changeIsCash: true,
      }).sales.toString(),
    ).toBe('87')
  })

  it('keeps the whole cash tender when change leaves a wallet', () => {
    expect(
      drawerCashMovement({
        kind: 'SALE',
        payments: [
          { isCash: true, amount: '100' },
          { isCash: false, amount: '0' },
        ],
        changeAmount: '13',
        changeIsCash: false,
      }).sales.toString(),
    ).toBe('100')
  })

  it('treats an older net cash sale, with no change stored, as that net', () => {
    expect(
      drawerCashMovement({
        kind: 'SALE',
        payments: [{ isCash: true, amount: '87' }],
        changeAmount: '0',
        changeIsCash: false,
      }).sales.toString(),
    ).toBe('87')
  })
})
