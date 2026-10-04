import { describe, expect, it } from 'vitest'

import { bandDetail, customerBands } from '@/lib/customer-bands'

const AS_OF = '2026-10-01'
const FROM = '2026-09-01'

describe('customer money bar', () => {
  it('splits estimates, overdue invoices, current invoices, credits and recent payments', () => {
    const bands = customerBands(
      [
        { customerId: 'a', type: 'ESTIMATE', status: 'DRAFT', total: '500', applied: '0', due: null, date: '2026-09-01' },
        { customerId: 'a', type: 'ESTIMATE', status: 'CLOSED', total: '900', applied: '0', due: null, date: '2026-08-01' },
        { customerId: 'b', type: 'INVOICE', status: 'OPEN', total: '100', applied: '0', due: '2026-09-01', date: '2026-08-01' },
        { customerId: 'b', type: 'INVOICE', status: 'PARTIAL', total: '80', applied: '30', due: '2026-12-01', date: '2026-09-15' },
        { customerId: 'c', type: 'INVOICE', status: 'DRAFT', total: '40', applied: '0', due: '2026-09-01', date: '2026-09-01' },
        { customerId: 'c', type: 'INVOICE', status: 'PAID', total: '20', applied: '20', due: '2026-08-01', date: '2026-07-01' },
        { customerId: 'a', type: 'CREDIT_MEMO', status: 'OPEN', total: '15', applied: '0', due: null, date: '2026-09-20' },
      ],
      [
        { customerId: 'b', status: 'OPEN', amount: '30', date: '2026-09-20' },
        { customerId: 'b', status: 'VOID', amount: '99', date: '2026-09-21' },
        { customerId: 'a', status: 'OPEN', amount: '10', date: '2026-08-01' },
      ],
      AS_OF,
      FROM,
    )

    expect(bands.estimates).toMatchObject({ amount: '500.00', count: 1, customerIds: ['a'] })
    expect(bands.overdue).toMatchObject({ amount: '100.00', count: 1, customerIds: ['b'] })
    expect(bands.open).toMatchObject({ amount: '50.00', count: 1, extra: 1 })
    expect(bands.open.customerIds.sort()).toEqual(['a', 'b'])
    expect(bands.paid).toMatchObject({ amount: '30.00', count: 1, customerIds: ['b'] })
    expect(bandDetail(bands.open)).toBe('1 open invoice and 1 credit')
    expect(bandDetail(bands.overdue)).toBe('1 overdue invoice')
  })

  it('puts an opening balance on the open bar when there is no invoice', () => {
    const bands = customerBands([], [], AS_OF, FROM, [
      { customerId: 'a', balance: '10200' },
      { customerId: 'b', balance: '0' },
    ])

    expect(bands.open.amount).toBe('10200.00')
    expect(bands.open.customerIds).toEqual(['a'])
    expect(bandDetail(bands.open)).toBe('1 open balance')
    expect(bands.overdue.amount).toBe('0.00')
  })
})
