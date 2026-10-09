import { describe, expect, it } from 'vitest'

import {
  posOrderListLimit,
  posOrderPresetParams,
  readPosOrderReportQuery,
  summarizePosWallets,
  type PosMethodCatalogItem,
  type PosOrderSummaryInput,
} from '@/lib/pos-order-report'

const AS_OF = '2026-10-09'

const METHODS: PosMethodCatalogItem[] = [
  { id: 'cash', name: 'Cash', sortOrder: 0, isActive: true },
  { id: 'edahab88', name: 'EDAHAB 88', sortOrder: 1, isActive: true },
  { id: 'edahab-blue', name: 'EDAHAB BLUE', sortOrder: 2, isActive: true },
  { id: 'evc88', name: 'EVC 88', sortOrder: 3, isActive: true },
  { id: 'evc-blue', name: 'EVC BLUE PLASTIC', sortOrder: 4, isActive: true },
  { id: 'merchant', name: 'MERCHANT BLUE PLASTIC', sortOrder: 5, isActive: true },
  { id: 'old', name: 'Old wallet', sortOrder: 9, isActive: false },
]

function sale(payments: PosOrderSummaryInput['payments']): PosOrderSummaryInput {
  return { payments }
}

function pay(
  methodId: string,
  amount: string,
  extra: Partial<PosOrderSummaryInput['payments'][number]> = {},
): PosOrderSummaryInput['payments'][number] {
  const method = METHODS.find((row) => row.id === methodId)
  return {
    methodId,
    methodName: method?.name ?? methodId,
    sortOrder: method?.sortOrder ?? 0,
    amount,
    refund: false,
    ...extra,
  }
}

describe('summarizePosWallets', () => {
  it('attributes a split sale to each wallet and sums every wallet', () => {
    const result = summarizePosWallets(
      [
        sale([pay('edahab88', '10.00'), pay('evc88', '15.00')]),
        sale([pay('cash', '6.00')]),
        sale([
          pay('edahab88', '10.00'),
          pay('edahab-blue', '20.00'),
          pay('evc88', '15.00'),
          pay('evc-blue', '8.00'),
          pay('cash', '1.00'),
        ]),
      ],
      METHODS,
    )

    const amount = (id: string) => result.wallets.find((wallet) => wallet.methodId === id)?.amount.toFixed(2)

    expect(amount('edahab88')).toBe('20.00')
    expect(amount('evc88')).toBe('30.00')
    expect(amount('cash')).toBe('7.00')
    expect(amount('edahab-blue')).toBe('20.00')
    expect(amount('evc-blue')).toBe('8.00')
    expect(amount('merchant')).toBe('0.00')
    expect(result.wallets.some((wallet) => wallet.methodId === 'old')).toBe(false)
    expect(result.orderCount).toBe(3)
    expect(result.total.toFixed(2)).toBe('85.00')
    expect(result.total.toFixed(2)).toBe(
      result.wallets.reduce((sum, wallet) => sum.plus(wallet.amount), result.total.minus(result.total)).toFixed(2),
    )
  })

  it('adds two lines on the same wallet and subtracts a refund', () => {
    const result = summarizePosWallets(
      [
        sale([pay('edahab88', '10.00'), pay('edahab88', '5.00'), pay('evc88', '15.00')]),
        sale([pay('evc88', '15.00', { refund: true })]),
      ],
      METHODS,
    )

    const amount = (id: string) => result.wallets.find((wallet) => wallet.methodId === id)?.amount.toFixed(2)
    expect(amount('edahab88')).toBe('15.00')
    expect(amount('evc88')).toBe('0.00')
    expect(result.total.toFixed(2)).toBe('15.00')
    expect(result.orderCount).toBe(2)
  })

  it('keeps an inactive wallet when the filtered orders used it', () => {
    const result = summarizePosWallets([sale([pay('old', '4.50')])], METHODS)
    const old = result.wallets.find((wallet) => wallet.methodId === 'old')
    expect(old?.amount.toFixed(2)).toBe('4.50')
    expect(old?.name).toBe('Old wallet')
    expect(result.total.toFixed(2)).toBe('4.50')
  })

  it('counts an order that has no payment lines', () => {
    const result = summarizePosWallets([sale([])], METHODS)
    expect(result.orderCount).toBe(1)
    expect(result.total.toFixed(2)).toBe('0.00')
  })
})

describe('readPosOrderReportQuery', () => {
  it('resolves Today in the organisation timezone', () => {
    expect(readPosOrderReportQuery({ date: 'today' }, AS_OF)).toEqual({
      preset: 'today',
      from: AS_OF,
      to: AS_OF,
      registerId: undefined,
      paymentMethodId: undefined,
    })
  })

  it('lets an explicit range win, and swaps a backwards range', () => {
    expect(
      readPosOrderReportQuery(
        { date: 'today', from: '2026-10-09', to: '2026-10-01', register: ' reg-1 ', method: 'cash' },
        AS_OF,
      ),
    ).toEqual({
      preset: 'custom',
      from: '2026-10-01',
      to: '2026-10-09',
      registerId: 'reg-1',
      paymentMethodId: 'cash',
    })
  })

  it('highlights a preset when the boxes match it', () => {
    const query = readPosOrderReportQuery({ from: AS_OF, to: AS_OF }, AS_OF)
    expect(query.preset).toBe('today')
  })

  it('ignores a date that is not a calendar day and reads the first repeated key', () => {
    expect(readPosOrderReportQuery({ from: 'yesterday', date: ['month', 'today'], register: ['', 'reg'] }, AS_OF)).toMatchObject({
      preset: 'month',
      from: '2026-10-01',
      to: '2026-10-31',
      registerId: undefined,
    })
  })

  it('treats an empty query as every date', () => {
    expect(readPosOrderReportQuery({}, AS_OF)).toEqual({
      preset: '',
      from: undefined,
      to: undefined,
      registerId: undefined,
      paymentMethodId: undefined,
    })
  })
})

describe('pos order list limits', () => {
  it('keeps the newest 80 until a filter is set', () => {
    expect(posOrderListLimit({})).toBe(80)
    expect(posOrderListLimit({ from: AS_OF, to: AS_OF })).toBe(2000)
    expect(posOrderListLimit({ registerId: 'reg-1' })).toBe(2000)
    expect(posOrderListLimit({ paymentMethodId: 'cash' })).toBe(2000)
  })

  it('keeps the register and wallet when a preset chip is chosen', () => {
    expect(
      posOrderPresetParams(
        { preset: 'custom', from: '2026-10-01', to: '2026-10-09', registerId: 'reg-1', paymentMethodId: 'cash' },
        'today',
      ),
    ).toEqual({ date: 'today', register: 'reg-1', method: 'cash' })
  })
})
