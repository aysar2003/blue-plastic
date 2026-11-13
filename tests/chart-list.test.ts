import { describe, expect, it } from 'vitest'

import {
  CHART_LIST_SINCE,
  isOriginalChartAccount,
  listedOnOriginalChart,
} from '@/server/accounting/chart-of-accounts'

describe('original chart list', () => {
  it('keeps the known chart and a system account, and drops a store account', () => {
    expect(isOriginalChartAccount({ name: 'Cash on Hand', systemKey: null })).toBe(true)
    expect(isOriginalChartAccount({ name: 'Inventory Asset', systemKey: 'INVENTORY_ASSET' })).toBe(true)
    expect(
      isOriginalChartAccount({ name: 'Renamed receivable', systemKey: 'ACCOUNTS_RECEIVABLE' }),
    ).toBe(true)
    expect(isOriginalChartAccount({ name: 'Store ka Hospitalka', systemKey: null })).toBe(false)
    expect(isOriginalChartAccount({ name: 'Xafiiska', systemKey: null })).toBe(false)
  })

  it('leaves older custom accounts off the list and keeps ones a company adds later', () => {
    expect(
      listedOnOriginalChart({
        name: 'ASAL FOOD',
        systemKey: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      }),
    ).toBe(false)
    expect(
      listedOnOriginalChart({
        name: 'My new store',
        systemKey: null,
        createdAt: CHART_LIST_SINCE,
      }),
    ).toBe(true)
    expect(
      listedOnOriginalChart({
        name: 'Rent',
        systemKey: null,
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
      }),
    ).toBe(true)
  })
})
