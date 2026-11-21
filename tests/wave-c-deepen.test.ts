import { describe, expect, it } from 'vitest'

import { hireContractName, isPayrollEligible } from '@/lib/erp/hris-hire'
import { hoursFileCsv, leaveDaysToHours } from '@/lib/erp/hours-export'
import { pickPaymentDateRate, realisedFxResidual } from '@/lib/erp/fx-payment'
import { loanAgingBucket, overdueAgingTotals } from '@/lib/erp/loan-aging'
import { collectionCredits, shouldAccrueInterest } from '@/lib/erp/loan-interest'
import {
  applyStatementPackRow,
  remapStatementHeader,
  statementFormatPackById,
} from '@/lib/erp/statement-import-packs'
import {
  isOverdueSubscriptionInvoice,
  reminderSubject,
  unearnedToClear,
  upcomingInvoiceLabel,
} from '@/lib/erp/subscription-dunning'
import { slotsOverlap } from '@/lib/erp/appointment-overlap'
import { payrollStatutoryToCsvForPack } from '@/lib/statutory-exports'
import { Decimal } from '@/lib/money'
import { parseCsv } from '@/lib/csv'

describe('phase 15 HRIS hire + hours', () => {
  it('is payroll-eligible after hire with wage or open contract', () => {
    expect(
      isPayrollEligible({
        lifecycleStatus: 'ACTIVE',
        active: true,
        wageAmount: '0',
        hasOpenContract: true,
      }),
    ).toBe(true)
    expect(
      isPayrollEligible({
        lifecycleStatus: 'ACTIVE',
        active: true,
        wageAmount: '1500',
      }),
    ).toBe(true)
    expect(
      isPayrollEligible({
        lifecycleStatus: 'LEFT',
        active: false,
        wageAmount: '1500',
      }),
    ).toBe(false)
    expect(hireContractName('Amina', 'Clerk')).toBe('Amina · Clerk')
  })

  it('exports leave and attendance hours as a simple CSV', () => {
    expect(leaveDaysToHours('2', '8')).toBe('16.0000')
    const csv = hoursFileCsv([
      { date: '2026-04-01', employee: 'Amina', kind: 'leave', hours: '8.0000', note: 'Annual' },
      { date: '2026-04-02', employee: 'Amina', kind: 'attendance', hours: '7.5000' },
    ])
    expect(csv.split('\r\n')[0]).toBe('date,employee,kind,hours,note')
    expect(csv).toContain('leave')
    expect(csv).toContain('7.5000')
  })

  it('payroll CSV uses localization pack headers', () => {
    const rows = [
      {
        runId: 'r',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        payslipNumber: 'PS-1',
        employeeCode: 'E1',
        employeeName: 'Sam',
        department: null,
        gross: '100',
        deductions: '10',
        employer: '5',
        net: '90',
        lines: [],
      },
    ]
    const so = payrollStatutoryToCsvForPack(rows, 'so')
    const ke = payrollStatutoryToCsvForPack(rows, 'ke')
    expect(so.split('\r\n')[0]).toContain('periodStart')
    expect(ke.split('\r\n')[0]).toContain('pay_period_from')
  })
})

describe('phase 16 collab overlap + planning stub', () => {
  it('refuses overlapping appointment slots', () => {
    const a0 = new Date('2026-11-21T09:00:00Z')
    const a1 = new Date('2026-11-21T10:00:00Z')
    const b0 = new Date('2026-11-21T09:30:00Z')
    const b1 = new Date('2026-11-21T10:30:00Z')
    expect(slotsOverlap(a0, a1, b0, b1)).toBe(true)
    expect(slotsOverlap(a0, a1, a1, b1)).toBe(false)
  })
})

describe('phase 13 FX payment-date rate', () => {
  it('uses table rate on the payment date and residual to FX gain/loss', () => {
    const rate = pickPaymentDateRate({
      baseCurrency: 'USD',
      paymentCurrency: 'EUR',
      enteredRate: '1',
      tableRate: '3.5',
    })
    expect(rate.toFixed(1)).toBe('3.5')
    const fx = realisedFxResidual({
      foreignAmount: '100',
      paymentDateRate: '3.5',
      applications: [{ foreignAmount: '100', documentRate: '3.0' }],
    })
    expect(fx.bankBase.toFixed(0)).toBe('350')
    expect(fx.controlBase.toFixed(0)).toBe('300')
    expect(fx.residual.toFixed(0)).toBe('50')
  })

  it('same-currency payment has no FX residual', () => {
    const rate = pickPaymentDateRate({
      baseCurrency: 'USD',
      paymentCurrency: 'USD',
      enteredRate: '3.5',
      tableRate: '3.5',
    })
    expect(rate.toFixed(0)).toBe('1')
  })
})

describe('phase 57 loans', () => {
  it('ages overdue schedule lines', () => {
    expect(loanAgingBucket('2026-01-01', '2026-01-01')).toBe('current')
    expect(loanAgingBucket('2026-01-01', '2026-01-20')).toBe('1-30')
    expect(loanAgingBucket('2026-01-01', '2026-03-15')).toBe('61-90')
    expect(loanAgingBucket('2026-01-01', '2026-05-01')).toBe('90+')
    const totals = overdueAgingTotals(
      [
        { dueDate: '2026-01-01', principalDue: '100', interestDue: '10' },
        { dueDate: '2026-04-01', principalDue: '50', interestDue: '0', paidAt: '2026-04-02' },
      ],
      '2026-02-01',
    )
    expect(totals.overdueCount).toBe(1)
    expect(totals.buckets['31-60']).toBe('110.0000')
  })

  it('does not accrue interest twice', () => {
    expect(shouldAccrueInterest({ paidAt: null, interestJournalId: null, interestDue: '12' })).toBe(
      true,
    )
    expect(
      shouldAccrueInterest({ paidAt: null, interestJournalId: 'j1', interestDue: '12' }),
    ).toBe(false)
    const accrued = collectionCredits({
      principalDue: '100',
      interestDue: '12',
      interestAccrued: true,
    })
    expect(accrued.interestIncome.toFixed(0)).toBe('0')
    expect(accrued.accruedReceivable.toFixed(0)).toBe('12')
    const fresh = collectionCredits({
      principalDue: '100',
      interestDue: '12',
      interestAccrued: false,
    })
    expect(fresh.interestIncome.toFixed(0)).toBe('12')
  })
})

describe('phase 36 dunning + unearned', () => {
  it('flags overdue subscription invoices and remaining unearned', () => {
    expect(isOverdueSubscriptionInvoice({ status: 'OPEN', overdue: true })).toBe(true)
    expect(isOverdueSubscriptionInvoice({ status: 'PAID', overdue: true })).toBe(false)
    expect(unearnedToClear('120', '40').toFixed(0)).toBe('80')
    expect(reminderSubject('INV-9')).toContain('INV-9')
    expect(upcomingInvoiceLabel('Rent', '2026-12-01', '100')).toContain('2026-12-01')
  })
})

describe('phase 6 statement import packs', () => {
  it('maps SO and KE headers onto date/amount/description', () => {
    const so = statementFormatPackById('so')
    expect(remapStatementHeader('Value Date', so)).toBe('date')
    expect(remapStatementHeader('Narration', so)).toBe('description')
    expect(remapStatementHeader('Dr', so)).toBe('debit')
    const ke = statementFormatPackById('ke')
    expect(remapStatementHeader('Paid In', ke)).toBe('credit')
    expect(remapStatementHeader('Withdrawn', ke)).toBe('debit')
    const { rows } = parseCsv('Value Date,Narration,Dr,Cr\n21/11/2026,Fuel,0,50\n')
    const mapped = applyStatementPackRow(rows[0]!, so)
    expect(mapped.date).toBe('21/11/2026')
    expect(mapped.description).toBe('Fuel')
    expect(mapped.credit).toBe('50')
  })
})

describe('fx residual decimal', () => {
  it('keeps four-decimal money', () => {
    const fx = realisedFxResidual({
      foreignAmount: new Decimal('10.50'),
      paymentDateRate: new Decimal('2'),
      applications: [{ foreignAmount: '10.50', documentRate: '1.5' }],
    })
    expect(fx.residual.toFixed(2)).toBe('5.25')
  })
})
