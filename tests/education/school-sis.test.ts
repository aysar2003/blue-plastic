import { describe, expect, it } from 'vitest'

import {
  assertScoreInRange,
  attendanceSummary,
  isAttendanceMark,
  letterFromPercent,
  weightedGradePercent,
} from '@/lib/erp/school-sis'
import { getPack } from '@/lib/packs'

describe('school SIS helpers', () => {
  it('validates attendance marks and score ranges', () => {
    expect(isAttendanceMark('PRESENT')).toBe(true)
    expect(isAttendanceMark('SKIP')).toBe(false)
    expect(assertScoreInRange(85, 100)).toBeNull()
    expect(assertScoreInRange(120, 100)).toMatch(/exceed/i)
  })

  it('computes weighted averages and letters', () => {
    expect(
      weightedGradePercent([
        { score: 80, maxScore: 100, weightPercent: 50 },
        { score: 90, maxScore: 100, weightPercent: 50 },
      ]),
    ).toBe(85)
    expect(letterFromPercent(85)).toBe('B')
    expect(letterFromPercent(null)).toBe('—')
  })

  it('summarizes attendance', () => {
    expect(
      attendanceSummary(['PRESENT', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED']),
    ).toEqual({
      present: 2,
      absent: 1,
      late: 1,
      excused: 1,
      total: 5,
      rate: 60,
    })
  })
})

describe('school pack', () => {
  it('includes SIS checklist and scopes', () => {
    const pack = getPack('school')
    expect(pack?.setupChecklist.some((row) => row.id === 'classes')).toBe(true)
    expect(pack?.setupChecklist.some((row) => row.id === 'grades')).toBe(true)
    expect(pack?.inScope.some((line) => /attendance/i.test(line))).toBe(true)
    expect(pack?.outOfScope.some((line) => /LMS/i.test(line))).toBe(true)
  })
})
