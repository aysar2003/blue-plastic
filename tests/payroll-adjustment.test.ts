import { describe, expect, it } from 'vitest'

import { payslipAdjustmentSchema, payslipLineIdSchema } from '@/lib/validation/payroll'
import { employeeUpdateSchema } from '@/lib/validation/employee'

describe('payslip adjustments', () => {
  it('accepts a bonus earning', () => {
    const parsed = payslipAdjustmentSchema.parse({
      payslipId: 'cmvsdbsb0000008l4vc7fqmmg',
      kind: 'EARNING',
      label: 'Ramadan bonus',
      amount: '250.00',
    })
    expect(parsed.kind).toBe('EARNING')
    expect(parsed.label).toBe('Ramadan bonus')
    expect(parsed.amount).toBe('250.00')
  })

  it('accepts a deduction', () => {
    const parsed = payslipAdjustmentSchema.parse({
      payslipId: 'cmvsdbsb0000008l4vc7fqmmg',
      kind: 'DEDUCTION',
      label: 'Advance recovery',
      amount: '50',
    })
    expect(parsed.kind).toBe('DEDUCTION')
  })

  it('rejects zero amount', () => {
    expect(() =>
      payslipAdjustmentSchema.parse({
        payslipId: 'cmvsdbsb0000008l4vc7fqmmg',
        kind: 'EARNING',
        label: 'Bonus',
        amount: '0',
      }),
    ).toThrow()
  })

  it('parses line id for remove', () => {
    expect(payslipLineIdSchema.parse({ id: 'cmvsdbsb0000008l4vc7fqmmg' }).id).toBe(
      'cmvsdbsb0000008l4vc7fqmmg',
    )
  })
})

describe('wage raise note on employee update', () => {
  it('keeps an optional raise note with wage fields', () => {
    const parsed = employeeUpdateSchema.parse({
      id: 'cmvsdbsb0000008l4vc7fqmmg',
      name: 'Amina Hassan',
      wageType: 'MONTHLY',
      wageAmount: '1200',
      wageRaiseNote: 'Annual raise 2026',
    })
    expect(parsed.wageRaiseNote).toBe('Annual raise 2026')
    expect(parsed.wageAmount).toBe('1200')
  })
})
