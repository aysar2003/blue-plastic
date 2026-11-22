import { assertTermDates } from '@/lib/erp/education'
import type { PackId } from './types'

/** Packs that collect academic year structure at register Confirm. */
export const EDUCATION_REGISTER_PACKS = ['school', 'university'] as const
export type EducationRegisterPack = (typeof EDUCATION_REGISTER_PACKS)[number]

export function isEducationRegisterPack(
  packId: string | null | undefined,
): packId is EducationRegisterPack {
  return packId === 'school' || packId === 'university'
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export type AcademicCalendarInput = {
  academicYearLabel: string
  termCount: 2 | 3
  term1StartsOn: string
  term1EndsOn: string
  term2StartsOn: string
  term2EndsOn: string
  term3StartsOn: string | null
  term3EndsOn: string | null
  midVacationStartsOn: string | null
  midVacationEndsOn: string | null
  endVacationStartsOn: string | null
  endVacationEndsOn: string | null
}

export type SeedTermRow = {
  name: string
  startsOn: string
  endsOn: string
}

/** Sensible school-year defaults: Term 1 → mid vacation → Term 2 → end vacation. */
export function defaultAcademicCalendar(now = new Date()): AcademicCalendarInput {
  const y = now.getUTCFullYear()
  return {
    academicYearLabel: String(y),
    termCount: 2,
    term1StartsOn: `${y}-01-15`,
    term1EndsOn: `${y}-05-31`,
    midVacationStartsOn: `${y}-06-01`,
    midVacationEndsOn: `${y}-07-31`,
    term2StartsOn: `${y}-08-01`,
    term2EndsOn: `${y}-11-30`,
    term3StartsOn: null,
    term3EndsOn: null,
    endVacationStartsOn: `${y}-12-01`,
    endVacationEndsOn: `${y}-12-31`,
  }
}

function emptyToNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t ? t : null
}

/** Read academic calendar fields from a register form / JSON bag. */
export function parseAcademicCalendarFromForm(
  raw: Record<string, unknown>,
): AcademicCalendarInput | null {
  const label = typeof raw.academicYearLabel === 'string' ? raw.academicYearLabel.trim() : ''
  const term1StartsOn = typeof raw.term1StartsOn === 'string' ? raw.term1StartsOn.trim() : ''
  const term1EndsOn = typeof raw.term1EndsOn === 'string' ? raw.term1EndsOn.trim() : ''
  const term2StartsOn = typeof raw.term2StartsOn === 'string' ? raw.term2StartsOn.trim() : ''
  const term2EndsOn = typeof raw.term2EndsOn === 'string' ? raw.term2EndsOn.trim() : ''
  if (!label || !term1StartsOn || !term1EndsOn || !term2StartsOn || !term2EndsOn) return null

  const countRaw = Number(raw.termCount ?? 2)
  const termCount: 2 | 3 = countRaw === 3 ? 3 : 2

  return {
    academicYearLabel: label.slice(0, 40),
    termCount,
    term1StartsOn,
    term1EndsOn,
    term2StartsOn,
    term2EndsOn,
    term3StartsOn: emptyToNull(raw.term3StartsOn),
    term3EndsOn: emptyToNull(raw.term3EndsOn),
    midVacationStartsOn: emptyToNull(raw.midVacationStartsOn),
    midVacationEndsOn: emptyToNull(raw.midVacationEndsOn),
    endVacationStartsOn: emptyToNull(raw.endVacationStartsOn),
    endVacationEndsOn: emptyToNull(raw.endVacationEndsOn),
  }
}

export function academicCalendarFromUnknown(value: unknown): AcademicCalendarInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return parseAcademicCalendarFromForm(value as Record<string, unknown>)
}

/** Validate required teaching terms (+ optional vacation / Term 3 windows). */
export function validateAcademicCalendar(cal: AcademicCalendarInput): string | null {
  if (!cal.academicYearLabel.trim()) return 'Enter the school year label (e.g. 2026).'
  for (const [label, start, end] of [
    ['Term 1', cal.term1StartsOn, cal.term1EndsOn],
    ['Term 2', cal.term2StartsOn, cal.term2EndsOn],
  ] as const) {
    if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) {
      return `${label} needs start and end dates.`
    }
    const err = assertTermDates(start, end)
    if (err) return `${label}: ${err}`
  }
  if (cal.termCount === 3) {
    if (!cal.term3StartsOn || !cal.term3EndsOn) return 'Term 3 needs start and end dates.'
    const err = assertTermDates(cal.term3StartsOn, cal.term3EndsOn)
    if (err) return `Term 3: ${err}`
  }
  for (const [label, start, end] of [
    ['Mid-year vacation', cal.midVacationStartsOn, cal.midVacationEndsOn],
    ['End-of-year vacation', cal.endVacationStartsOn, cal.endVacationEndsOn],
  ] as const) {
    if (!start && !end) continue
    if (!start || !end) return `${label}: fill both start and end, or leave both blank.`
    const err = assertTermDates(start, end)
    if (err) return `${label}: ${err}`
  }
  return null
}

/** Books year follows the first teaching day. */
export function fiscalStartFromAcademic(cal: AcademicCalendarInput): {
  fiscalYearStartMonth: number
  fiscalYearStartDay: number
} {
  const [y, m, d] = cal.term1StartsOn.split('-').map(Number)
  void y
  return {
    fiscalYearStartMonth: m || 1,
    fiscalYearStartDay: d || 1,
  }
}

/** Rows to insert as AcademicTerm (teaching terms + optional vacations). */
export function termsToSeed(cal: AcademicCalendarInput): SeedTermRow[] {
  const prefix = cal.academicYearLabel.trim()
  const rows: SeedTermRow[] = [
    { name: `${prefix} Term 1`, startsOn: cal.term1StartsOn, endsOn: cal.term1EndsOn },
  ]
  if (cal.midVacationStartsOn && cal.midVacationEndsOn) {
    rows.push({
      name: `${prefix} Mid-year vacation`,
      startsOn: cal.midVacationStartsOn,
      endsOn: cal.midVacationEndsOn,
    })
  }
  rows.push({ name: `${prefix} Term 2`, startsOn: cal.term2StartsOn, endsOn: cal.term2EndsOn })
  if (cal.termCount === 3 && cal.term3StartsOn && cal.term3EndsOn) {
    rows.push({
      name: `${prefix} Term 3`,
      startsOn: cal.term3StartsOn,
      endsOn: cal.term3EndsOn,
    })
  }
  if (cal.endVacationStartsOn && cal.endVacationEndsOn) {
    rows.push({
      name: `${prefix} End-of-year vacation`,
      startsOn: cal.endVacationStartsOn,
      endsOn: cal.endVacationEndsOn,
    })
  }
  return rows
}

export function packNeedsAcademicYear(packId: string | null | undefined): boolean {
  return isEducationRegisterPack(packId)
}
