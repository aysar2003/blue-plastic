import { describe, expect, it } from 'vitest'

import {
  assertTermDates,
  canBillEnrollment,
  canWithdrawEnrollment,
  enrollmentCount,
  normalizeScholarshipPercent,
  scholarshipDiscountAmount,
} from '@/lib/erp/education'
import { getPack } from '@/lib/packs'

describe('education helpers', () => {
  it('normalizes scholarship percent', () => {
    expect(normalizeScholarshipPercent(-5)).toBe(0)
    expect(normalizeScholarshipPercent(25)).toBe(25)
    expect(normalizeScholarshipPercent(150)).toBe(100)
  })

  it('computes scholarship discount without unbalancing math', () => {
    expect(scholarshipDiscountAmount('1000', 10)).toBe('100.0000')
    expect(scholarshipDiscountAmount('1000', 0)).toBe('0.0000')
  })

  it('gates billing and withdraw', () => {
    expect(canBillEnrollment({ status: 'ENROLLED', salesDocumentId: null })).toBe(true)
    expect(canBillEnrollment({ status: 'ENROLLED', salesDocumentId: 'inv1' })).toBe(false)
    expect(canBillEnrollment({ status: 'WITHDRAWN' })).toBe(false)
    expect(canWithdrawEnrollment('ENROLLED')).toBe(true)
    expect(canWithdrawEnrollment('COMPLETED')).toBe(false)
  })

  it('counts enrollments and validates term dates', () => {
    expect(
      enrollmentCount([
        { status: 'ENROLLED' },
        { status: 'ENROLLED' },
        { status: 'WITHDRAWN' },
        { status: 'COMPLETED' },
      ]),
    ).toEqual({ active: 2, withdrawn: 1, completed: 1, total: 4 })

    expect(assertTermDates('2026-01-01', '2026-06-30')).toBeNull()
    expect(assertTermDates('2026-06-30', '2026-01-01')).toMatch(/end date/i)
  })
})

describe('education packs', () => {
  it('marks school and university vertical-ready with fees outstanding', () => {
    expect(getPack('school')?.verticalStatus).toBe('ready')
    expect(getPack('university')?.verticalStatus).toBe('ready')
    expect(getPack('school')?.setupChecklist.some((row) => row.id === 'enroll')).toBe(true)
    expect(getPack('school')?.setupChecklist.some((row) => row.id === 'outstanding')).toBe(true)
    expect(getPack('school')?.inScope.some((line) => /fees outstanding/i.test(line))).toBe(true)
  })
})
