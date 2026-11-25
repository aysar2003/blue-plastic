import { describe, expect, it } from 'vitest'

import {
  ADMISSION_STATUSES,
  assertDayOfWeek,
  assertPeriodIndex,
  assertTimeOrder,
  hostelRoomFull,
  isAdmissionStatus,
  isAssignmentStatus,
  isDisciplineSeverity,
  slotsOverlap,
} from '@/lib/erp/school-ops'
import { getPack } from '@/lib/packs'

describe('school ops helpers', () => {
  it('validates timetable fields', () => {
    expect(assertDayOfWeek(1)).toBeNull()
    expect(assertDayOfWeek(9)).toMatch(/0–6/)
    expect(assertPeriodIndex(3)).toBeNull()
    expect(assertPeriodIndex(0)).toMatch(/1–16/)
    expect(assertTimeOrder('08:00', '08:45')).toBeNull()
    expect(assertTimeOrder('09:00', '08:00')).toMatch(/after/)
  })

  it('checks hostel capacity and enums', () => {
    expect(hostelRoomFull(4, 4)).toBe(true)
    expect(hostelRoomFull(4, 3)).toBe(false)
    expect(isAssignmentStatus('SUBMITTED')).toBe(true)
    expect(isDisciplineSeverity('WARNING')).toBe(true)
    expect(isAdmissionStatus('OFFERED')).toBe(true)
    expect(isAdmissionStatus('WAITLIST')).toBe(false)
    expect(ADMISSION_STATUSES).toContain('ENROLLED')
  })

  it('detects overlapping timetable clock windows', () => {
    expect(slotsOverlap({ startsAt: '08:00', endsAt: '08:45' }, { startsAt: '08:30', endsAt: '09:15' })).toBe(
      true,
    )
    expect(slotsOverlap({ startsAt: '08:00', endsAt: '08:45' }, { startsAt: '08:45', endsAt: '09:30' })).toBe(
      false,
    )
  })
})

describe('school pack ops', () => {
  it('includes timetable, transport, hostel, assignments, admissions', () => {
    const pack = getPack('school')
    expect(pack?.setupChecklist.some((row) => row.id === 'timetable')).toBe(true)
    expect(pack?.setupChecklist.some((row) => row.id === 'transport')).toBe(true)
    expect(pack?.setupChecklist.some((row) => row.id === 'admissions')).toBe(true)
    expect(pack?.setupChecklist.some((row) => row.id === 'campuses')).toBe(true)
    expect(pack?.setupChecklist.some((row) => row.id === 'exams')).toBe(true)
    expect(pack?.inScope.some((line) => /Assignments/i.test(line))).toBe(true)
    expect(pack?.inScope.some((line) => /Hostel/i.test(line))).toBe(true)
    expect(pack?.inScope.some((line) => /Admissions/i.test(line))).toBe(true)
    expect(pack?.outOfScope.some((line) => /SCORM/i.test(line))).toBe(true)
  })
})
