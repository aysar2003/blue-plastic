import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import { EARLIEST_DATE, priorPeriod, priorYear, resolvePeriod } from '@/lib/report-periods'
import { toCsv } from '@/server/reports/csv'

/**
 * A calendar year (fiscal year starting in January) and a year starting in
 * April, because "this quarter" means something different in each and getting it
 * wrong silently reports the wrong three months.
 */
describe('report periods', () => {
  const today = '2026-08-29'

  it('resolves the ordinary presets', () => {
    expect(resolvePeriod('this-month', today, 1)).toEqual({ from: '2026-08-01', to: '2026-08-31' })
    expect(resolvePeriod('last-month', today, 1)).toEqual({ from: '2026-07-01', to: '2026-07-31' })
    expect(resolvePeriod('this-fiscal-year', today, 1)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(resolvePeriod('last-fiscal-year', today, 1)).toEqual({ from: '2025-01-01', to: '2025-12-31' })
    expect(resolvePeriod('year-to-date', today, 1)).toEqual({ from: '2026-01-01', to: '2026-08-29' })
  })

  it('resolves the short presets', () => {
    // 2026-08-29 is a Saturday, so the business week it belongs to is
    // Monday 24 August to Sunday 30 August.
    expect(resolvePeriod('today', today, 1)).toEqual({ from: '2026-08-29', to: '2026-08-29' })
    expect(resolvePeriod('this-week', today, 1)).toEqual({ from: '2026-08-24', to: '2026-08-30' })
    expect(resolvePeriod('last-week', today, 1)).toEqual({ from: '2026-08-17', to: '2026-08-23' })
  })

  it('takes "all dates" back further than any set of books reaches', () => {
    expect(resolvePeriod('all-dates', today, 1)).toEqual({ from: EARLIEST_DATE, to: today })
  })

  it('runs quarters from the start of the fiscal year, not from January', () => {
    // Calendar year: August is in Q3, July–September.
    expect(resolvePeriod('this-quarter', today, 1)).toEqual({ from: '2026-07-01', to: '2026-09-30' })
    // Year starting in April: August is in Q2, July–September as it happens.
    expect(resolvePeriod('this-quarter', today, 4)).toEqual({ from: '2026-07-01', to: '2026-09-30' })
    // Year starting in June: August is in Q1, June–August.
    expect(resolvePeriod('this-quarter', today, 6)).toEqual({ from: '2026-06-01', to: '2026-08-31' })
  })

  it('takes the last quarter as the three months before this one', () => {
    expect(resolvePeriod('last-quarter', today, 1)).toEqual({ from: '2026-04-01', to: '2026-06-30' })
    expect(resolvePeriod('last-quarter', today, 6)).toEqual({ from: '2026-03-01', to: '2026-05-31' })
  })

  it('resolves named fiscal quarters for this year and last year', () => {
    expect(resolvePeriod('fy-q1', today, 1)).toEqual({ from: '2026-01-01', to: '2026-03-31' })
    expect(resolvePeriod('fy-q2', today, 1)).toEqual({ from: '2026-04-01', to: '2026-06-30' })
    expect(resolvePeriod('fy-q3', today, 1)).toEqual({ from: '2026-07-01', to: '2026-09-30' })
    expect(resolvePeriod('fy-q4', today, 1)).toEqual({ from: '2026-10-01', to: '2026-12-31' })
    expect(resolvePeriod('last-fy-q1', today, 1)).toEqual({ from: '2025-01-01', to: '2025-03-31' })
    expect(resolvePeriod('last-fy-q4', today, 1)).toEqual({ from: '2025-10-01', to: '2025-12-31' })
    // April fiscal year: Q1 is Apr–Jun.
    expect(resolvePeriod('fy-q1', today, 4)).toEqual({ from: '2026-04-01', to: '2026-06-30' })
    expect(resolvePeriod('last-fy-q1', today, 4)).toEqual({ from: '2025-04-01', to: '2025-06-30' })
  })

  it('handles a fiscal year that spans the new year', () => {
    // A year starting in October: today is in the year that began 2025-10-01.
    expect(resolvePeriod('this-fiscal-year', today, 10)).toEqual({ from: '2025-10-01', to: '2026-09-30' })
  })

  it('compares against the same length of period immediately before', () => {
    expect(priorPeriod({ from: '2026-08-01', to: '2026-08-31' })).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
    })
    // 31 days, so the previous 31 days — not the previous calendar month.
    expect(priorPeriod({ from: '2026-03-01', to: '2026-03-31' })).toEqual({
      from: '2026-01-29',
      to: '2026-02-28',
    })
  })

  it('compares against the same dates a year earlier', () => {
    expect(priorYear({ from: '2026-01-01', to: '2026-12-31' })).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
    })
  })
})

describe('csv', () => {
  const body = (csv: string) => csv.replace('﻿', '').trimEnd().split('\r\n')

  it('writes money as a plain decimal a spreadsheet will read as a number', () => {
    expect(body(toCsv([['Rent', new Decimal('1234.5')]]))).toEqual(['Rent,1234.50'])
  })

  it('quotes anything containing a comma, a quote or a newline', () => {
    expect(body(toCsv([['Ali, Hodan & Co']]))).toEqual(['"Ali, Hodan & Co"'])
    expect(body(toCsv([['He said "no"']]))).toEqual(['"He said ""no"""'])
  })

  it('defuses a field a spreadsheet would run as a formula', () => {
    // A customer name is user input, and Excel treats a leading = as a formula.
    expect(body(toCsv([['=1+1']]))).toEqual(["'=1+1"])
    expect(body(toCsv([['@SUM(A1)']]))).toEqual(["'@SUM(A1)"])
    // But a negative number is a number, not an attack.
    expect(body(toCsv([[new Decimal('-40')]]))).toEqual(['-40.00'])
  })

  it('writes an empty cell for a missing value rather than the word undefined', () => {
    expect(body(toCsv([['Total', null, undefined, 3]]))).toEqual(['Total,,,3'])
  })
})
