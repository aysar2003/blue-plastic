/** School ops helpers — timetable, assignments, hostel capacity (pure). */

export const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
] as const

export const ASSIGNMENT_STATUSES = ['ASSIGNED', 'SUBMITTED', 'GRADED', 'RETURNED'] as const
export type AssignmentSubmissionStatus = (typeof ASSIGNMENT_STATUSES)[number]

export const SCHOOL_AUDIENCES = ['ALL', 'STAFF', 'PARENTS', 'STUDENTS'] as const
export type SchoolAudience = (typeof SCHOOL_AUDIENCES)[number]

export const DISCIPLINE_SEVERITIES = ['NOTE', 'WARNING', 'DETENTION', 'SUSPENSION'] as const
export type DisciplineSeverity = (typeof DISCIPLINE_SEVERITIES)[number]

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function assertDayOfWeek(day: number): string | null {
  if (!Number.isInteger(day) || day < 0 || day > 6) return 'Day of week must be 0–6.'
  return null
}

export function assertPeriodIndex(period: number): string | null {
  if (!Number.isInteger(period) || period < 1 || period > 16) return 'Period must be 1–16.'
  return null
}

export function assertClockTime(value: string): string | null {
  if (!TIME.test(value.trim())) return 'Time must be HH:MM (24h).'
  return null
}

export function assertTimeOrder(startsAt: string, endsAt: string): string | null {
  if (assertClockTime(startsAt) || assertClockTime(endsAt)) {
    return assertClockTime(startsAt) || assertClockTime(endsAt)
  }
  if (endsAt <= startsAt) return 'End time must be after start time.'
  return null
}

export function hostelRoomFull(capacity: number, occupied: number): boolean {
  return occupied >= capacity
}

export function isAssignmentStatus(value: string): value is AssignmentSubmissionStatus {
  return (ASSIGNMENT_STATUSES as readonly string[]).includes(value)
}

export function isSchoolAudience(value: string): value is SchoolAudience {
  return (SCHOOL_AUDIENCES as readonly string[]).includes(value)
}

export function isDisciplineSeverity(value: string): value is DisciplineSeverity {
  return (DISCIPLINE_SEVERITIES as readonly string[]).includes(value)
}
