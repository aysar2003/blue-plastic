import { describe, expect, it } from 'vitest'

import { money } from '@/lib/money'
import {
  amountFromSlabs,
  applyAdvances,
  applyOvertimeOverride,
  buildPayrollJournal,
  buildPayrollSettlementJournal,
  buildStandardLines,
  countWorkdaysInRange,
  endOfServiceAmount,
  payOvertimeHours,
  paymentSummaryByMethod,
  periodsOverlap,
  slipTotals,
  workingDaysInPeriod,
} from '@/lib/payroll-standard'

const month = {
  wageType: 'MONTHLY' as const,
  wageAmount: '1000',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  hiredAt: null,
  leftAt: null,
  hoursPerDay: '8',
  workDaysPerWeek: 6,
  overtimeAfterHoursPerDay: '8',
  overtimeMultiplier: '1.5',
  workedDays: 0,
  workedHours: '0',
  unpaidLeaveDays: '0',
  expenseAccountId: 'exp',
  rules: [],
}

describe('standard payroll math', () => {
  it('counts a 6-day week across October', () => {
    expect(workingDaysInPeriod(31, 6)).toBe(27)
  })

  it('pays a full monthly wage when nobody is on leave', () => {
    const built = buildStandardLines(month)
    expect(built.skip).toBeNull()
    const totals = slipTotals(built.lines)
    expect(totals.gross.toFixed(2)).toBe('1000.00')
    expect(totals.net.toFixed(2)).toBe('1000.00')
  })

  it('prorates a joiner and cuts unpaid leave from the expense, not as a withheld tax', () => {
    const built = buildStandardLines({
      ...month,
      hiredAt: '2026-10-16',
      unpaidLeaveDays: '1',
    })
    const salary = built.lines.find((row) => row.code === 'SALARY')
    const unpaid = built.lines.find((row) => row.code === 'UNPAID_LEAVE')
    expect(salary?.label).toContain('16/31')
    expect(Number(salary?.amount.toFixed(2))).toBeLessThan(1000)
    expect(unpaid).toBeTruthy()
    const journal = buildPayrollJournal({
      payMode: 'IMMEDIATE',
      payFromAccountId: 'bank',
      liabilityAccountId: 'tax',
      slips: [
        {
          name: 'Amina',
          department: 'Sales',
          expenseAccountId: 'exp',
          payableAccountId: null,
          payAccountId: null,
          payMethod: 'BANK',
          lines: built.lines.map((row) => ({
            code: row.code,
            label: row.label,
            amount: row.amount.toFixed(4),
            kind: row.kind,
            affectsNet: row.affectsNet,
            expenseAccountId: row.expenseAccountId,
            liabilityAccountId: row.liabilityAccountId,
          })),
        },
      ],
    })
    expect(journal.error).toBeNull()
    const tax = journal.lines.filter((row) => row.accountId === 'tax')
    expect(tax).toHaveLength(0)
    const debit = journal.lines.reduce((sum, row) => sum + Number(row.debit), 0)
    const credit = journal.lines.reduce((sum, row) => sum + Number(row.credit), 0)
    expect(debit).toBeCloseTo(credit, 2)
  })

  it('posts gross expense, a deduction liability, and net pay', () => {
    const journal = buildPayrollJournal({
      payMode: 'IMMEDIATE',
      payFromAccountId: 'bank',
      liabilityAccountId: 'tax',
      slips: [
        {
          name: 'Amina',
          department: 'Sales',
          expenseAccountId: 'exp',
          payableAccountId: 'payable',
          payAccountId: 'mobile',
          payMethod: 'MOBILE',
          lines: [
            {
              code: 'SALARY',
              label: 'Monthly salary',
              amount: '1000',
              kind: 'EARNING',
              affectsNet: true,
              expenseAccountId: null,
              liabilityAccountId: null,
            },
            {
              code: 'TAX',
              label: 'Tax',
              amount: '100',
              kind: 'DEDUCTION',
              affectsNet: true,
              expenseAccountId: null,
              liabilityAccountId: null,
            },
            {
              code: 'PENSION',
              label: 'Employer pension',
              amount: '50',
              kind: 'EARNING',
              affectsNet: false,
              expenseAccountId: 'exp',
              liabilityAccountId: 'tax',
            },
          ],
        },
      ],
    })
    expect(journal.error).toBeNull()
    const byAccount = (id: string) =>
      journal.lines
        .filter((row) => row.accountId === id)
        .reduce((sum, row) => sum + Number(row.debit) - Number(row.credit), 0)
    expect(byAccount('exp')).toBeCloseTo(1050, 2)
    expect(byAccount('tax')).toBeCloseTo(-150, 2)
    expect(byAccount('mobile')).toBeCloseTo(-900, 2)
  })

  it('accrues net pay to the payable account', () => {
    const journal = buildPayrollJournal({
      payMode: 'ACCRUE',
      payFromAccountId: 'bank',
      liabilityAccountId: 'tax',
      slips: [
        {
          name: 'Amina',
          department: null,
          expenseAccountId: 'exp',
          payableAccountId: 'payable',
          payAccountId: 'bank',
          payMethod: 'CASH',
          lines: [
            {
              code: 'SALARY',
              label: 'Monthly salary',
              amount: '800',
              kind: 'EARNING',
              affectsNet: true,
              expenseAccountId: 'exp',
              liabilityAccountId: null,
            },
          ],
        },
      ],
    })
    expect(journal.lines.some((row) => row.accountId === 'payable' && Number(row.credit) === 800)).toBe(true)
  })

  it('applies a housing percent and keeps employer cost out of net', () => {
    const built = buildStandardLines({
      ...month,
      rules: [
        {
          code: 'BASIC',
          name: 'Basic',
          kind: 'EARNING',
          calc: 'BASE',
          amount: '0',
          expenseAccountId: 'exp',
          liabilityAccountId: null,
          sortOrder: 0,
        },
        {
          code: 'HOUSE',
          name: 'Housing',
          kind: 'EARNING',
          calc: 'PERCENT',
          amount: '10',
          expenseAccountId: 'exp',
          liabilityAccountId: null,
          sortOrder: 1,
        },
        {
          code: 'ER',
          name: 'Employer pension',
          kind: 'EMPLOYER',
          calc: 'PERCENT',
          amount: '5',
          expenseAccountId: 'exp',
          liabilityAccountId: 'tax',
          sortOrder: 2,
        },
      ],
    })
    const totals = slipTotals(built.lines)
    expect(totals.gross.toFixed(2)).toBe('1100.00')
    expect(totals.employer.toFixed(2)).toBe('50.00')
    expect(totals.net.toFixed(2)).toBe('1100.00')
  })

  it('recovers an advance without taking net below zero', () => {
    const built = buildStandardLines(month)
    const applied = applyAdvances(built.lines, [
      { id: 'adv', label: 'Salary advance', balance: '400', installment: '250', accountId: 'asset' },
    ])
    const totals = slipTotals(applied.lines)
    expect(totals.net.toFixed(2)).toBe('750.00')
    expect(applied.recoveries[0]?.amount.toFixed(2)).toBe('250.00')
  })

  it('flags overlapping periods and prices end of service', () => {
    expect(periodsOverlap('2026-10-01', '2026-10-31', '2026-10-15', '2026-11-15')).toBe(true)
    expect(periodsOverlap('2026-10-01', '2026-10-31', '2026-11-01', '2026-11-30')).toBe(false)
    const eos = endOfServiceAmount({
      monthlyWage: '1200',
      hiredAt: '2025-10-31',
      asOf: '2026-10-31',
      monthsPerYear: '1',
    })
    expect(eos).not.toBeNull()
    expect(Number(eos?.amount.toFixed(2))).toBeGreaterThan(1100)
    expect(Number(eos?.amount.toFixed(2))).toBeLessThan(1300)
  })

  it('settles accrued wages payable into cash or bank', () => {
    const journal = buildPayrollSettlementJournal({
      payFromAccountId: 'bank',
      liabilityAccountId: 'payable',
      slips: [
        {
          name: 'Amina',
          department: 'Sales',
          payableAccountId: 'payable',
          payAccountId: null,
          payMethod: 'BANK',
          net: '900',
        },
        {
          name: 'Omar',
          department: null,
          payableAccountId: null,
          payAccountId: 'cash',
          payMethod: 'CASH',
          net: '500',
        },
      ],
    })
    expect(journal.error).toBeNull()
    const payableDebit = journal.lines
      .filter((row) => row.accountId === 'payable' && row.debit.gt(0))
      .reduce((sum, row) => sum.plus(row.debit), journal.lines[0]!.debit.mul(0))
    expect(payableDebit.toFixed(2)).toBe('1400.00')
    expect(journal.lines.find((row) => row.accountId === 'bank')?.credit.toFixed(2)).toBe('900.00')
    expect(journal.lines.find((row) => row.accountId === 'cash')?.credit.toFixed(2)).toBe('500.00')
  })

  it('summarises the payment batch by method and applies OT override', () => {
    const summary = paymentSummaryByMethod([
      { payMethod: 'CASH', net: '100', included: true },
      { payMethod: 'CASH', net: '50', included: true },
      { payMethod: 'MOBILE', net: '200', included: true },
      { payMethod: 'BANK', net: '10', included: false },
    ])
    expect(summary).toEqual([
      { method: 'CASH', count: 2, net: expect.anything() },
      { method: 'MOBILE', count: 1, net: expect.anything() },
    ])
    expect(summary[0]?.net.toFixed(2)).toBe('150.00')
    const withOt = applyOvertimeOverride(buildStandardLines(month).lines, '75')
    expect(withOt.find((row) => row.code === 'OT')?.amount.toFixed(2)).toBe('75.00')
  })

  it('taxes progressive slabs on basic', () => {
    expect(
      amountFromSlabs(money(1000), [
        { upTo: '500', rate: '0' },
        { upTo: '1000', rate: '10' },
        { upTo: null, rate: '20' },
      ]).toFixed(2),
    ).toBe('50.00')
    const built = buildStandardLines({
      ...month,
      rules: [
        {
          code: 'BASIC',
          name: 'Basic',
          kind: 'EARNING',
          calc: 'BASE',
          amount: '0',
          expenseAccountId: 'exp',
          liabilityAccountId: null,
          sortOrder: 0,
        },
        {
          code: 'TAX',
          name: 'Income tax',
          kind: 'DEDUCTION',
          calc: 'SLABS',
          amount: '0',
          slabs: [
            { upTo: '500', rate: '0' },
            { upTo: '1000', rate: '10' },
            { upTo: null, rate: '20' },
          ],
          expenseAccountId: null,
          liabilityAccountId: 'tax',
          sortOrder: 10,
        },
      ],
    })
    const totals = slipTotals(built.lines)
    expect(totals.gross.toFixed(2)).toBe('1000.00')
    expect(totals.deductions.toFixed(2)).toBe('50.00')
    expect(totals.net.toFixed(2)).toBe('950.00')
  })

  it('prorates a mid-period leaver on a new run', () => {
    const built = buildStandardLines({
      ...month,
      leftAt: '2026-10-15',
    })
    expect(built.skip).toBeNull()
    expect(built.lines.find((row) => row.code === 'SALARY')?.label).toContain('15/31')
    expect(Number(built.lines.find((row) => row.code === 'SALARY')?.amount.toFixed(2))).toBeCloseTo(
      (1000 * 15) / 31,
      1,
    )
  })

  it('tags journal lines with a department tracking category', () => {
    const journal = buildPayrollJournal({
      payMode: 'IMMEDIATE',
      payFromAccountId: 'bank',
      liabilityAccountId: 'tax',
      slips: [
        {
          name: 'Amina',
          department: 'Sales',
          trackingCategoryId: 'track-sales',
          expenseAccountId: 'exp',
          payableAccountId: null,
          payAccountId: null,
          payMethod: 'BANK',
          lines: [
            {
              code: 'SALARY',
              label: 'Monthly salary',
              amount: '1000',
              kind: 'EARNING',
              affectsNet: true,
              expenseAccountId: null,
              liabilityAccountId: null,
            },
          ],
        },
      ],
    })
    expect(journal.error).toBeNull()
    expect(journal.lines.every((row) => row.trackingCategoryId === 'track-sales')).toBe(true)
  })

  it('splits overtime across 1.5x and 2x bands', () => {
    const ot = payOvertimeHours(money(10), money(6), 1, [
      { afterHours: '8', multiplier: '1.5' },
      { afterHours: '12', multiplier: '2' },
    ])
    // 4h × 1.5 × 10 + 2h × 2 × 10 = 60 + 40 = 100
    expect(ot.amount.toFixed(2)).toBe('100.00')
    const hourly = buildStandardLines({
      ...month,
      wageType: 'HOURLY',
      wageAmount: '10',
      workedDays: 1,
      workedHours: '14',
      overtimeAfterHoursPerDay: '8',
      overtimeMultiplier: '1.5',
      overtimeRules: [{ afterHours: '12', multiplier: '2' }],
    })
    expect(hourly.lines.find((row) => row.code === 'OT')?.amount.toFixed(2)).toBe('100.00')
  })

  it('counts Mon–Sat workdays in October 2026', () => {
    expect(countWorkdaysInRange('2026-10-01', '2026-10-31', [1, 2, 3, 4, 5, 6])).toBe(27)
  })
})
