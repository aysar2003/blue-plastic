import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import {
  minorityInterest,
  normalizeOwnershipPercent,
  ownedShare,
  rollupWithOwnership,
  suggestIcPairs,
} from '@/lib/erp/consolidation-ownership'

describe('ownership percent', () => {
  it('clamps to 0–100', () => {
    expect(normalizeOwnershipPercent('80').toString()).toBe('80')
    expect(normalizeOwnershipPercent(150).toString()).toBe('100')
    expect(normalizeOwnershipPercent(-5).toString()).toBe('0')
    expect(normalizeOwnershipPercent(undefined).toString()).toBe('100')
  })

  it('splits owned share and NCI', () => {
    expect(ownedShare(1000, 80).toString()).toBe('800')
    expect(minorityInterest(1000, 80).toString()).toBe('200')
    expect(minorityInterest(500, 100).toString()).toBe('0')
  })
})

describe('consol rollup with NCI', () => {
  it('rolls subsidiaries at ownership % and accumulates NCI', () => {
    const rollup = rollupWithOwnership([
      {
        orgId: 'parent',
        isParent: true,
        ownershipPercent: new Decimal(100),
        income: new Decimal(1000),
        expense: new Decimal(400),
        net: new Decimal(600),
        assets: new Decimal(5000),
        liabilities: new Decimal(2000),
        equity: new Decimal(3000),
      },
      {
        orgId: 'sub',
        isParent: false,
        ownershipPercent: new Decimal(80),
        income: new Decimal(200),
        expense: new Decimal(50),
        net: new Decimal(150),
        assets: new Decimal(1000),
        liabilities: new Decimal(400),
        equity: new Decimal(600),
      },
    ])
    expect(rollup.income.toString()).toBe('1160')
    expect(rollup.expense.toString()).toBe('440')
    expect(rollup.net.toString()).toBe('720')
    expect(rollup.assets.toString()).toBe('5800')
    expect(rollup.equity.toString()).toBe('3480')
    expect(rollup.nci.toString()).toBe('120')
  })
})

describe('IC pair suggestions', () => {
  it('pairs equal amounts across orgs within the date window', () => {
    const pairs = suggestIcPairs(
      [
        { id: 'a', orgId: 'o1', date: '2026-11-01', amount: 500 },
        { id: 'b', orgId: 'o2', date: '2026-11-03', amount: 500 },
        { id: 'c', orgId: 'o2', date: '2026-11-20', amount: 500 },
        { id: 'd', orgId: 'o1', date: '2026-11-02', amount: 200 },
      ],
      7,
    )
    expect(pairs).toEqual([{ aId: 'a', bId: 'b', amount: '500.0000' }])
  })

  it('does not pair same-org journals', () => {
    expect(
      suggestIcPairs([
        { id: 'a', orgId: 'o1', date: '2026-11-01', amount: 100 },
        { id: 'b', orgId: 'o1', date: '2026-11-01', amount: 100 },
      ]),
    ).toEqual([])
  })
})
