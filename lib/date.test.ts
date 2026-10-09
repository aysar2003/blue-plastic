import { describe, expect, it } from 'vitest'

import {
  addDays,
  addMonths,
  calendarDateInZone,
  endOfMonth,
  fiscalYearOf,
  fiscalYearRange,
  formatDate,
  formatDateTime,
  formatTransactionDate,
  isCalendarDate,
  isWithin,
  startOfMonth,
  toCalendarDate,
  toDate,
} from './date'

describe('calendar dates', () => {
  it('validates real dates only', () => {
    expect(isCalendarDate('2026-02-28')).toBe(true)
    expect(isCalendarDate('2026-02-30')).toBe(false)
    expect(isCalendarDate('2026-13-01')).toBe(false)
    expect(isCalendarDate('26-01-01')).toBe(false)
  })

  it('round-trips through UTC midnight, immune to the local timezone', () => {
    const date = toDate('2026-01-31')
    expect(date.toISOString()).toBe('2026-01-31T00:00:00.000Z')
    expect(toCalendarDate(date)).toBe('2026-01-31')
  })
})

describe('arithmetic', () => {
  it('clamps month-end rather than overflowing', () => {
    // 31 January + 1 month is the end of February, not 2 or 3 March.
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('finds month boundaries', () => {
    expect(startOfMonth('2026-08-28')).toBe('2026-08-01')
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29')
  })

  it('tests inclusive ranges', () => {
    expect(isWithin('2026-01-01', '2026-01-01', '2026-01-31')).toBe(true)
    expect(isWithin('2026-01-31', '2026-01-01', '2026-01-31')).toBe(true)
    expect(isWithin('2026-02-01', '2026-01-01', '2026-01-31')).toBe(false)
  })
})

describe('fiscal years', () => {
  it('labels a calendar-year fiscal year by its own year', () => {
    expect(fiscalYearOf('2026-01-01', 1)).toBe(2026)
    expect(fiscalYearOf('2026-12-31', 1)).toBe(2026)
  })

  it('labels an offset fiscal year by the year it begins in', () => {
    expect(fiscalYearOf('2026-04-01', 4)).toBe(2026)
    expect(fiscalYearOf('2026-03-31', 4)).toBe(2025)
  })

  it('produces a 12-month range', () => {
    expect(fiscalYearRange(2026, 1)).toEqual({ start: '2026-01-01', end: '2026-12-31' })
    expect(fiscalYearRange(2026, 4)).toEqual({ start: '2026-04-01', end: '2027-03-31' })
    expect(fiscalYearRange(2026, 7)).toEqual({ start: '2026-07-01', end: '2027-06-30' })
  })
})

describe('display', () => {
  const mogadishu = 'Africa/Mogadishu'
  // 08:05 UTC is 11:05 in Mogadishu (UTC+3), still 9 October.
  const at1105 = new Date('2026-10-09T08:05:00.000Z')

  it('formats a calendar date without a clock', () => {
    expect(formatDate('2026-10-09')).toBe('Oct 9, 2026')
  })

  it('formats an instant in the organisation timezone', () => {
    expect(formatDateTime(at1105, mogadishu)).toBe('Oct 9, 2026, 11:05 AM')
    expect(calendarDateInZone(at1105, mogadishu)).toBe('2026-10-09')
    // Just after midnight local is still the next calendar day, not UTC's day.
    const justAfterMidnight = new Date('2026-10-09T21:05:00.000Z')
    expect(formatDateTime(justAfterMidnight, mogadishu)).toBe('Oct 10, 2026, 12:05 AM')
  })

  it('attaches the clock only when the timestamp falls on that business date', () => {
    expect(formatTransactionDate('2026-10-09', at1105, mogadishu)).toBe('Oct 9, 2026, 11:05 AM')
    expect(formatTransactionDate('2026-10-09', null, mogadishu)).toBe('Oct 9, 2026')
    expect(formatTransactionDate('2026-10-09', undefined, mogadishu)).toBe('Oct 9, 2026')
    // Backdated: the books say 1 October, the row was typed on the 9th.
    expect(formatTransactionDate('2026-10-01', at1105, mogadishu)).toBe('Oct 1, 2026')
  })
})
