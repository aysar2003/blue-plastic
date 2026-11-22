import { describe, expect, it } from 'vitest'

import {
  defaultAcademicCalendar,
  fiscalStartFromAcademic,
  termsToSeed,
  validateAcademicCalendar,
} from '@/lib/packs/academic-year'

describe('academic-year', () => {
  it('defaults include Term 1, Term 2, and vacations', () => {
    const cal = defaultAcademicCalendar(new Date('2026-03-01T00:00:00Z'))
    expect(cal.academicYearLabel).toBe('2026')
    expect(cal.termCount).toBe(2)
    expect(termsToSeed(cal).map((t) => t.name)).toEqual([
      '2026 Term 1',
      '2026 Mid-year vacation',
      '2026 Term 2',
      '2026 End-of-year vacation',
    ])
  })

  it('books year follows Term 1 start', () => {
    const cal = defaultAcademicCalendar(new Date('2026-03-01T00:00:00Z'))
    cal.term1StartsOn = '2026-09-01'
    expect(fiscalStartFromAcademic(cal)).toEqual({
      fiscalYearStartMonth: 9,
      fiscalYearStartDay: 1,
    })
  })

  it('requires Term 3 dates when termCount is 3', () => {
    const cal = defaultAcademicCalendar()
    cal.termCount = 3
    expect(validateAcademicCalendar(cal)).toMatch(/Term 3/)
    cal.term3StartsOn = '2026-12-01'
    cal.term3EndsOn = '2027-02-28'
    expect(validateAcademicCalendar(cal)).toBeNull()
  })
})
