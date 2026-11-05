import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import {
  buildVatReturnBoxes,
  payrollStatutoryToCsv,
  vatReturnToCsv,
  type PayrollStatutoryLine,
} from '@/lib/statutory-exports'

describe('statutory payroll export', () => {
  it('flattens payslip lines into CSV columns', () => {
    const rows: PayrollStatutoryLine[] = [
      {
        runId: 'r1',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        payslipNumber: 'PS-1',
        employeeCode: 'E1',
        employeeName: 'Amina Ali',
        department: 'Ops',
        gross: '1000.00',
        deductions: '100.00',
        employer: '50.00',
        net: '900.00',
        lines: [
          { code: 'BASIC', label: 'Basic', kind: 'EARNING', amount: '1000.00', affectsNet: true },
          { code: 'TAX', label: 'Tax', kind: 'DEDUCTION', amount: '100.00', affectsNet: true },
        ],
      },
    ]
    const csv = payrollStatutoryToCsv(rows)
    expect(csv).toContain('periodStart,periodEnd')
    expect(csv).toContain('Amina Ali')
    expect(csv).toContain('BASIC')
    expect(csv).toContain('TAX')
  })
})

describe('VAT return boxes', () => {
  it('nets output minus input', () => {
    const boxes = buildVatReturnBoxes({
      jurisdiction: 'SO',
      from: '2026-01-01',
      to: '2026-03-31',
      salesNet: '10000',
      salesTax: '500',
      purchaseNet: '4000',
      purchaseTax: '200',
    })
    expect(boxes.box5NetVatDue.equals(new Decimal(300))).toBe(true)
    const csv = vatReturnToCsv(boxes)
    expect(csv).toContain('box5_net_vat_due,300.00')
    expect(csv).toContain('SO')
  })
})
