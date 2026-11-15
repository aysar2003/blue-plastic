import { describe, expect, it } from 'vitest'

import {
  findOverBudgetBuckets,
  formatOverBudgetMessage,
} from '@/lib/erp/budget-control'
import {
  budgetCellKey,
  collapseToFirstMonth,
  inflateAmount,
  monthsInRange,
  parseBudgetCsvRows,
  parseBudgetMonth,
  spreadAmountAcrossMonths,
  spreadEvenlyAcross,
  wouldExceedBudget,
} from '@/lib/erp/budget-deep'
import { parseFeatureFlags } from '@/lib/feature-flags'

describe('budget-deep helpers', () => {
  it('lists months in a calendar range', () => {
    expect(monthsInRange('2026-01-01', '2026-03-15')).toEqual([1, 2, 3])
    expect(monthsInRange('2026-11-01', '2027-02-28')).toEqual([11, 12, 1, 2])
    expect(monthsInRange('2026-05-01', '2026-04-01')).toEqual([])
  })

  it('spreads amounts with remainder on last month', () => {
    expect(spreadAmountAcrossMonths('100', 3)).toEqual(['33.3333', '33.3333', '33.3334'])
    expect(spreadAmountAcrossMonths('10', 1)).toEqual(['10.0000'])
  })

  it('inflates by percent', () => {
    expect(inflateAmount('100', 10)).toBe('110.0000')
    expect(inflateAmount('100', -10)).toBe('90.0000')
  })

  it('collapses to first month and spreads evenly', () => {
    expect(collapseToFirstMonth({ 1: '10', 2: '20', 3: '30' })).toEqual({
      1: '60.0000',
      2: '0.0000',
      3: '0.0000',
    })
    expect(spreadEvenlyAcross('90', [1, 2, 3])).toEqual({
      1: '30.0000',
      2: '30.0000',
      3: '30.0000',
    })
  })

  it('parses CSV month and rows', () => {
    expect(parseBudgetMonth('3')).toBe(3)
    expect(parseBudgetMonth('2026-07')).toBe(7)
    expect(parseBudgetMonth('13')).toBeNull()
    const { rows, issues } = parseBudgetCsvRows([
      { accountCode: '6100', month: '1', amount: '100', className: 'Ops' },
      { accountCode: '', month: '2', amount: '5' },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.className).toBe('Ops')
    expect(issues).toHaveLength(1)
  })

  it('flags overspend against monthly budget', () => {
    expect(
      wouldExceedBudget({ budgeted: '100', actualPosted: '60', proposed: '50' }),
    ).toBe(true)
    expect(
      wouldExceedBudget({ budgeted: '100', actualPosted: '60', proposed: '40' }),
    ).toBe(false)
    expect(
      wouldExceedBudget({ budgeted: '0', actualPosted: '10', proposed: '10' }),
    ).toBe(false)
  })

  it('finds over-budget buckets for EXPENSE lines', () => {
    const key = budgetCellKey('acc1', 3, null)
    const over = findOverBudgetBuckets({
      month: 3,
      lines: [
        {
          accountId: 'acc1',
          accountCode: '6100',
          accountType: 'EXPENSE',
          trackingCategoryId: null,
          amount: '40',
        },
      ],
      budgetByCell: new Map([[key, { amount: '100', accountCode: '6100' }]]),
      actualByCell: new Map([[key, '70']]),
    })
    expect(over).toHaveLength(1)
    expect(formatOverBudgetMessage(over)).toContain('6100')
  })

  it('parses enforceBudgetControl feature flag', () => {
    expect(parseFeatureFlags({}).enforceBudgetControl).toBe(false)
    expect(parseFeatureFlags({ enforceBudgetControl: true }).enforceBudgetControl).toBe(true)
  })
})
