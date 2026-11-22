import { describe, expect, it } from 'vitest'

import {
  assertEducationRetentionSafe,
  buildNextYearTerms,
  canCloseAcademicYear,
  canCompleteEnrollment,
  canOpenSiblingYear,
  canPromoteEnrollment,
  nextAcademicYearLabel,
  renameTermForYear,
  shiftCalendarDate,
} from '@/lib/erp/academic-year-lifecycle'
import { getPack } from '@/lib/packs'

describe('academic year lifecycle', () => {
  it('blocks purge-style retention violations', () => {
    expect(() => assertEducationRetentionSafe('close academic year')).not.toThrow()
    expect(() => assertEducationRetentionSafe('delete old terms')).toThrow(/retention/i)
  })

  it('advances year labels and term dates for the next decade', () => {
    expect(nextAcademicYearLabel('2026')).toBe('2027')
    expect(nextAcademicYearLabel('2026/2027')).toBe('2027/2028')
    expect(shiftCalendarDate('2026-01-15', 1)).toBe('2027-01-15')
    expect(renameTermForYear('2026 Term 1', '2026', '2027')).toBe('2027 Term 1')
    expect(
      buildNextYearTerms(
        [
          { name: '2026 Term 1', startsOn: '2026-01-15', endsOn: '2026-05-31' },
          { name: '2026 Mid-year vacation', startsOn: '2026-06-01', endsOn: '2026-07-31' },
        ],
        '2026',
        '2027',
      ),
    ).toEqual([
      { name: '2027 Term 1', startsOn: '2027-01-15', endsOn: '2027-05-31' },
      { name: '2027 Mid-year vacation', startsOn: '2027-06-01', endsOn: '2027-07-31' },
    ])
  })

  it('gates close / open / complete / promote', () => {
    expect(canCloseAcademicYear('OPEN')).toBe(true)
    expect(canCloseAcademicYear('CLOSED')).toBe(false)
    expect(canOpenSiblingYear(0)).toBe(true)
    expect(canOpenSiblingYear(1)).toBe(false)
    expect(canCompleteEnrollment('ENROLLED')).toBe(true)
    expect(canCompleteEnrollment('WITHDRAWN')).toBe(false)
    expect(canPromoteEnrollment('COMPLETED')).toBe(true)
    expect(canPromoteEnrollment('WITHDRAWN')).toBe(false)
  })

  it('ships school longevity checklist and in-scope history', () => {
    const school = getPack('school')!
    expect(school.setupChecklist.some((row) => row.id === 'years')).toBe(true)
    expect(school.setupChecklist.some((row) => row.id === 'import')).toBe(true)
    expect(school.inScope.some((line) => /keep all history/i.test(line))).toBe(true)
    expect(school.inScope.some((line) => /multi-year history/i.test(line))).toBe(true)
    expect(getPack('university')?.setupChecklist.some((row) => row.id === 'years')).toBe(true)
  })
})
