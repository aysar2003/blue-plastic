/**
 * Pure helpers for multi-decade school years.
 * Year-close retains every education row — never deletes.
 */

export const ACADEMIC_YEAR_STATUSES = ['OPEN', 'CLOSED'] as const
export type AcademicYearStatus = (typeof ACADEMIC_YEAR_STATUSES)[number]

/** Education retention: year lifecycle must never hard-delete these entity kinds. */
export const EDUCATION_RETAINED_ENTITIES = [
  'AcademicYear',
  'AcademicTerm',
  'StudentEnrollment',
  'SchoolClass',
  'StudentAttendanceDay',
  'GradeEntry',
  'GradeItem',
] as const

export type EducationRetainedEntity = (typeof EDUCATION_RETAINED_ENTITIES)[number]

export function assertEducationRetentionSafe(action: string): void {
  const banned = /\b(delete|destroy|purge|truncate|drop)\b/i
  if (banned.test(action)) {
    throw new Error(
      `Education retention: "${action}" is not allowed on school history. Close the year instead.`,
    )
  }
}

/** Shift a calendar date by whole years (YYYY-MM-DD). */
export function shiftCalendarDate(iso: string, years: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${y + years}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Next year label: "2026" → "2027"; "2026/2027" → "2027/2028". */
export function nextAcademicYearLabel(label: string): string {
  const trimmed = label.trim()
  const range = trimmed.match(/^(\d{4})\s*[\/\-]\s*(\d{4})$/)
  if (range) {
    const a = Number(range[1]) + 1
    const b = Number(range[2]) + 1
    return `${a}/${b}`
  }
  const single = trimmed.match(/^(\d{4})$/)
  if (single) return String(Number(single[1]) + 1)
  return `${trimmed} (next)`
}

/** Rewrite term name prefix from old year label to new (best-effort). */
export function renameTermForYear(termName: string, fromLabel: string, toLabel: string): string {
  if (fromLabel && termName.startsWith(fromLabel)) {
    return `${toLabel}${termName.slice(fromLabel.length)}`
  }
  return `${toLabel} ${termName}`.trim()
}

export type TermTemplate = {
  name: string
  startsOn: string
  endsOn: string
}

/** Build next-year term rows by shifting dates +1 year from a closed year template. */
export function buildNextYearTerms(
  template: TermTemplate[],
  fromLabel: string,
  toLabel: string,
): TermTemplate[] {
  return template.map((term) => ({
    name: renameTermForYear(term.name, fromLabel, toLabel),
    startsOn: shiftCalendarDate(term.startsOn, 1),
    endsOn: shiftCalendarDate(term.endsOn, 1),
  }))
}

export function canCloseAcademicYear(status: AcademicYearStatus): boolean {
  return status === 'OPEN'
}

export function canOpenSiblingYear(existingOpenCount: number): boolean {
  return existingOpenCount === 0
}

export function canCompleteEnrollment(status: string): boolean {
  return status === 'ENROLLED'
}

export function canPromoteEnrollment(status: string): boolean {
  return status === 'COMPLETED' || status === 'ENROLLED'
}
