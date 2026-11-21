import { describe, expect, it } from 'vitest'

import { sessionCashVariance, sessionExpectedCash, sessionPnlSummary } from '@/lib/pos-session'

describe('POS session close deepen', () => {
  it('subtracts payouts from expected drawer cash', () => {
    expect(
      sessionExpectedCash({
        opening: '100',
        cashIn: '20',
        cashOut: '10',
        cashSales: '50',
        cashRefunds: '5',
        payouts: '15',
      }),
    ).toBe('140.0000')
  })

  it('computes counted vs expected variance and P&L', () => {
    expect(sessionCashVariance('138', '140')).toBe('-2.0000')
    expect(sessionPnlSummary({ sales: '50', refunds: '5', cashVariance: '-2' })).toEqual({
      sales: '50.0000',
      refunds: '5.0000',
      netSales: '45.0000',
      cashVariance: '-2.0000',
    })
  })
})
