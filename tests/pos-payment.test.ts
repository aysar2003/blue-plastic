import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PosPaymentForm, type PosPaymentMethodField } from '@/components/pos/payment-dialog'
import { clampPaymentDraft, exactRemainingAmount, nonCashDraftError, NON_CASH_OVERPAY_MESSAGE, settlePosPayments } from '@/lib/pos-payment'

const methods = [
  { id: 'cash', isCash: true },
  { id: 'edahab', isCash: false },
  { id: 'edahab-blue', isCash: false },
  { id: 'evc', isCash: false },
  { id: 'evc-blue', isCash: false },
  { id: 'merchant', isCash: false },
]

const wallets = { edahab: '10', 'edahab-blue': '20', evc: '15', 'evc-blue': '8' }

describe('settlePosPayments', () => {
  it('starts from empty fields, so cash is not assumed to cover the sale', () => {
    expect(settlePosPayments({ due: '54.00', methods, amounts: {} })).toEqual({
      paid: '0.00',
      remaining: '54.00',
      change: '0.00',
      nonCashWithinBalance: true,
      canValidate: false,
      payments: [],
      tenders: [],
    })
  })

  it('does not stack wallet payments on top of a cash tender the cashier never entered', () => {
    // The bug: cash was prefilled with the $54 total, then 10+20+15+8 was added,
    // and the slip showed Paid $107 / Change $53.
    const result = settlePosPayments({ due: '54.00', methods, amounts: wallets })
    expect(result.paid).toBe('53.00')
    expect(result.remaining).toBe('1.00')
    expect(result.change).toBe('0.00')
    expect(result.canValidate).toBe(false)
    expect(result.payments).toEqual([
      { paymentMethodId: 'edahab', amount: '10.00' },
      { paymentMethodId: 'edahab-blue', amount: '20.00' },
      { paymentMethodId: 'evc', amount: '15.00' },
      { paymentMethodId: 'evc-blue', amount: '8.00' },
    ])
    expect(result.tenders).toEqual(result.payments)
  })

  it('validates once the remaining dollar is entered as cash, with no change', () => {
    const result = settlePosPayments({ due: '54.00', methods, amounts: { ...wallets, cash: '1' } })
    expect(result.canValidate).toBe(true)
    expect(result.paid).toBe('54.00')
    expect(result.remaining).toBe('0.00')
    expect(result.change).toBe('0.00')
    expect(result.payments).toEqual([
      { paymentMethodId: 'cash', amount: '1.00' },
      { paymentMethodId: 'edahab', amount: '10.00' },
      { paymentMethodId: 'edahab-blue', amount: '20.00' },
      { paymentMethodId: 'evc', amount: '15.00' },
      { paymentMethodId: 'evc-blue', amount: '8.00' },
    ])
    expect(result.tenders).toEqual(result.payments)
  })

  it('turns only the extra cash into change and saves the cash the sale actually took', () => {
    const result = settlePosPayments({ due: '54.00', methods, amounts: { ...wallets, cash: '5' } })
    expect(result.canValidate).toBe(true)
    expect(result.paid).toBe('58.00')
    expect(result.remaining).toBe('0.00')
    expect(result.change).toBe('4.00')
    expect(result.payments.find((payment) => payment.paymentMethodId === 'cash')).toEqual({
      paymentMethodId: 'cash',
      amount: '1.00',
    })
    expect(result.tenders.find((payment) => payment.paymentMethodId === 'cash')).toEqual({
      paymentMethodId: 'cash',
      amount: '5.00',
    })
    const saved = result.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    expect(saved).toBe(54)
  })

  it('takes a cash sale with change and omits every method left at zero', () => {
    const result = settlePosPayments({ due: '28.00', methods, amounts: { cash: '30', evc: '', edahab: '0' } })
    expect(result.canValidate).toBe(true)
    expect(result.paid).toBe('30.00')
    expect(result.change).toBe('2.00')
    expect(result.payments).toEqual([{ paymentMethodId: 'cash', amount: '28.00' }])
    expect(result.tenders).toEqual([{ paymentMethodId: 'cash', amount: '30.00' }])
  })

  it('takes an exact wallet payment and does not invent a cash line', () => {
    const result = settlePosPayments({ due: '54.00', methods, amounts: { evc: '54' } })
    expect(result.canValidate).toBe(true)
    expect(result.change).toBe('0.00')
    expect(result.payments).toEqual([{ paymentMethodId: 'evc', amount: '54.00' }])
    expect(result.tenders).toEqual(result.payments)
  })

  it('refuses a non-cash amount past the sale and does not call the excess change', () => {
    const over = settlePosPayments({ due: '54.00', methods, amounts: { evc: '60' } })
    expect(over.nonCashWithinBalance).toBe(false)
    expect(over.canValidate).toBe(false)
    expect(over.change).toBe('0.00')

    const split = settlePosPayments({ due: '54.00', methods, amounts: { evc: '30', edahab: '30' } })
    expect(split.nonCashWithinBalance).toBe(false)
    expect(split.canValidate).toBe(false)
    expect(split.change).toBe('0.00')
  })

  it('requires an exact total when the register has no cash method', () => {
    const walletsOnly = methods.filter((method) => !method.isCash)
    const under = settlePosPayments({ due: '54.00', methods: walletsOnly, amounts: { evc: '40' } })
    expect(under.canValidate).toBe(false)
    expect(under.change).toBe('0.00')
    expect(under.remaining).toBe('14.00')

    const over = settlePosPayments({ due: '54.00', methods: walletsOnly, amounts: { evc: '54', edahab: '1' } })
    expect(over.canValidate).toBe(false)
    expect(over.change).toBe('0.00')

    const exact = settlePosPayments({ due: '54.00', methods: walletsOnly, amounts: { evc: '40', edahab: '14' } })
    expect(exact.canValidate).toBe(true)
    expect(exact.change).toBe('0.00')
    expect(exact.payments).toEqual([
      { paymentMethodId: 'edahab', amount: '14.00' },
      { paymentMethodId: 'evc', amount: '40.00' },
    ])
    expect(exact.tenders).toEqual(exact.payments)
  })

  it('keeps a zero-total sale from validating', () => {
    expect(settlePosPayments({ due: '0.00', methods, amounts: {} }).canValidate).toBe(false)
    expect(settlePosPayments({ due: '0.00', methods, amounts: { cash: '5' } }).canValidate).toBe(false)
  })
})

describe('exactRemainingAmount', () => {
  it('fills the amount still owed and stays blank once the sale is covered', () => {
    expect(exactRemainingAmount({ due: '54.00', methodId: 'cash', amounts: wallets })).toBe('1.00')
    expect(exactRemainingAmount({ due: '54.00', methodId: 'merchant', amounts: wallets })).toBe('1.00')
    expect(exactRemainingAmount({ due: '54.00', methodId: 'cash', amounts: {} })).toBe('54.00')
    expect(
      exactRemainingAmount({ due: '54.00', methodId: 'merchant', amounts: { ...wallets, cash: '1.00' } }),
    ).toBe('')
  })
})

const named: PosPaymentMethodField[] = [
  { id: 'cash', name: 'Cash', isCash: true },
  { id: 'edahab', name: 'EDAHAB 88', isCash: false },
  { id: 'edahab-blue', name: 'EDAHAB BLUE', isCash: false },
  { id: 'evc', name: 'EVC 88', isCash: false },
  { id: 'evc-blue', name: 'EVC BLUE PLASTIC', isCash: false },
  { id: 'merchant', name: 'MERCHANT BLUE PLASTIC', isCash: false },
]

function validateButton(html: string) {
  return html.match(/<button\b[^>]*>Validate<\/button>/)?.[0] ?? ''
}

function renderPayment(
  amounts: Record<string, string>,
  options: { due?: string; error?: string | null; canValidate?: boolean; changeMethodId?: string } = {},
) {
  const due = options.due ?? '54.00'
  const settlement = settlePosPayments({ due, methods: named, amounts })
  const error = options.error === undefined ? null : options.error
  const canValidate = options.canValidate ?? settlement.canValidate
  return renderToString(
    createElement(PosPaymentForm, {
      due,
      currency: 'USD',
      methods: named,
      amounts,
      paid: settlement.paid,
      remaining: settlement.remaining,
      change: settlement.change,
      canValidate,
      pending: false,
      error,
      dark: true,
      changeMethods: named.map((method) => ({ id: method.id, name: method.name })),
      changeMethodId: options.changeMethodId ?? 'cash',
      onChangeMethod: () => {},
      onAmount: () => {},
      onFill: () => {},
      onCancel: () => {},
      onValidate: () => {},
    }),
  ).replace(/<!-- -->/g, '')
}

describe('payment dialog', () => {
  it('opens on the amount due with every method blank and Validate disabled', () => {
    const html = renderPayment({})
    expect(html).toContain('Amount due')
    expect(html).toContain('$54.00')
    expect(html).not.toContain('Cash due')
    expect(html).not.toContain('Tendered')
    for (const method of named) {
      expect(html).toContain(`id="pay-${method.id}"`)
      expect(html).toContain(method.isCash ? 'Exact' : 'Remaining')
      expect(html).toMatch(new RegExp(`id="pay-${method.id}"[^>]*value=""`))
    }
    expect(html).toContain('Paid')
    expect(html).toContain('Remaining')
    expect(html).toContain('Change')
    expect(html).toContain('Return change from')
    expect(html).toContain('$0.00')
    expect(validateButton(html)).toContain('disabled=""')
  })

  it('keeps cash empty while wallet payments are short, so they are not added on top of the total', () => {
    const html = renderPayment(wallets)
    expect(html).toMatch(/id="pay-cash"[^>]*value=""/)
    expect(html).toMatch(/id="pay-edahab"[^>]*value="10"/)
    expect(html).toContain('$53.00')
    expect(html).toContain('$1.00')
    expect(validateButton(html)).toContain('disabled=""')
  })

  it('enables Validate and shows change only for the extra cash', () => {
    const html = renderPayment({ ...wallets, cash: '5' })
    expect(html).toMatch(/id="pay-cash"[^>]*value="5"/)
    expect(html).toContain('$58.00')
    expect(html).toContain('$4.00')
    expect(html).toContain('Return change from')
    expect(validateButton(html)).not.toContain('disabled=""')
  })

  it('does not show the non-cash error when only cash overpays and the wallet field is empty', () => {
    const html = renderPayment({ cash: '100' }, { due: '87.00' })
    expect(html).toMatch(/id="pay-edahab"[^>]*value=""/)
    expect(html).toContain('$13.00')
    expect(html).not.toContain(NON_CASH_OVERPAY_MESSAGE)
    expect(validateButton(html)).not.toContain('disabled=""')
  })

  it('disables Validate whenever a validation error is showing', () => {
    const html = renderPayment(
      { evc: '90' },
      { due: '87.00', error: NON_CASH_OVERPAY_MESSAGE, canValidate: true },
    )
    expect(html).toContain(NON_CASH_OVERPAY_MESSAGE)
    expect(validateButton(html)).toContain('disabled=""')
  })

  it('disables Validate when change is due and no return account is selected', () => {
    const html = renderPayment({ cash: '100' }, { due: '87.00', changeMethodId: '', canValidate: false })
    expect(html).toContain('Return change from')
    expect(validateButton(html)).toContain('disabled=""')
  })
})

describe('clampPaymentDraft', () => {
  it('leaves cash as typed, including an overpayment', () => {
    expect(
      clampPaymentDraft({ due: '54.00', method: methods[0]!, raw: '60', methods, amounts: wallets }),
    ).toEqual({ value: '60', clamped: false })
  })

  it('cuts a non-cash amount down to the balance the other wallets left', () => {
    expect(
      clampPaymentDraft({
        due: '54.00',
        method: methods[4]!,
        raw: '20',
        methods,
        amounts: { edahab: '10', 'edahab-blue': '20', evc: '15' },
      }),
    ).toEqual({ value: '9.00', clamped: true })
  })

  it('stops a wallet from exceeding the balance still owed, including cash already typed', () => {
    // Other wallets are $53 and cash is $20, so nothing of the $54 sale is left.
    // The digit is dropped and the field stays empty. That is not an overpayment
    // sitting in the field, so it must not raise the non-cash error.
    expect(
      clampPaymentDraft({
        due: '54.00',
        method: methods[5]!,
        raw: '1',
        methods,
        amounts: { ...wallets, cash: '20' },
      }),
    ).toEqual({ value: '', clamped: false })
    expect(nonCashDraftError(false, '')).toBeNull()

    // Cash $5 plus wallets $45 leaves $4. An $8 wallet entry is cut to that $4.
    expect(
      clampPaymentDraft({
        due: '54.00',
        method: methods[4]!,
        raw: '8',
        methods,
        amounts: { edahab: '10', 'edahab-blue': '20', evc: '15', cash: '5' },
      }),
    ).toEqual({ value: '4.00', clamped: true })
    expect(nonCashDraftError(true, '4.00')).toBe(NON_CASH_OVERPAY_MESSAGE)
  })

  it('does not treat a focused empty wallet as a non-cash overpayment when only cash overpays', () => {
    // The till in the screenshot: $87 due, cash 100, change $13, EDAHAB focused and blank.
    // Typing into that blank field used to wipe the digit and stick the overpay error on screen.
    const draft = clampPaymentDraft({
      due: '87.00',
      method: methods[1]!,
      raw: '1',
      methods,
      amounts: { cash: '100' },
    })
    expect(draft).toEqual({ value: '', clamped: false })
    expect(nonCashDraftError(draft?.clamped ?? false, draft?.value ?? '')).toBeNull()

    const settled = settlePosPayments({ due: '87.00', methods, amounts: { cash: '100', edahab: '' } })
    expect(settled.nonCashWithinBalance).toBe(true)
    expect(settled.change).toBe('13.00')
    expect(settled.canValidate).toBe(true)
    expect(settled.tenders).toEqual([{ paymentMethodId: 'cash', amount: '100.00' }])
    expect(settled.payments).toEqual([{ paymentMethodId: 'cash', amount: '87.00' }])
  })

  it('rejects keystrokes that are not an amount and clears a field', () => {
    expect(
      clampPaymentDraft({ due: '54.00', method: methods[3]!, raw: '10e', methods, amounts: {} }),
    ).toBeNull()
    expect(
      clampPaymentDraft({ due: '54.00', method: methods[3]!, raw: '', methods, amounts: { evc: '10' } }),
    ).toEqual({ value: '', clamped: false })
  })
})
