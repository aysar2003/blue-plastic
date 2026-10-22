import type { CalendarDate } from '@/lib/date'
import { isCalendarDate, today } from '@/lib/date'
import {
  isPeriodKey,
  priorPeriod,
  priorYear,
  resolvePeriod,
  type Period,
  type PeriodKey,
} from '@/lib/report-periods'
import type { ReportBasis } from '@/server/reports/framework'

export type ComparisonKey = 'none' | 'prior-period' | 'prior-year'

export const COMPARISON_LABELS: Record<ComparisonKey, string> = {
  none: 'No comparison',
  'prior-period': 'Previous period',
  'prior-year': 'Previous year',
}

export type SearchParams = Record<string, string | string[] | undefined>

export type ReportSettings = {
  period: PeriodKey
  range: Period
  basis: ReportBasis
  comparison: ComparisonKey
  comparisonRange?: Period
  asOf: CalendarDate
}

const one = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

/**
 * Every report reads its settings from the URL, so a report someone is looking
 * at can be sent to someone else and be the same report. Nothing about the view
 * is stored server-side, which also means there is no stale saved state to
 * explain when the answer changes.
 */
export function readSettings(
  query: SearchParams,
  organization: { timeZone: string; fiscalYearStartMonth: number },
  // Default to this month — a full fiscal year over ~40k sales lines / 100k
  // journal lines is the usual cause of “reports feel stuck”.
  fallback: PeriodKey = 'this-month',
): ReportSettings {
  const now = today(organization.timeZone)

  const from = one(query.from)
  const to = one(query.to)
  const custom = {
    from: from && isCalendarDate(from) ? from : undefined,
    to: to && isCalendarDate(to) ? to : undefined,
  }

  const requested = one(query.period)
  const period: PeriodKey = isPeriodKey(requested)
    ? requested
    : custom.from || custom.to
      ? 'custom'
      : fallback

  const range = resolvePeriod(period, now, organization.fiscalYearStartMonth, custom)
  const basis: ReportBasis = one(query.basis) === 'cash' ? 'cash' : 'accrual'

  const requestedComparison = one(query.compare)
  const comparison: ComparisonKey =
    requestedComparison === 'prior-period' || requestedComparison === 'prior-year'
      ? requestedComparison
      : 'none'

  const asOfParam = one(query.asOf)

  /**
   * "As at" never runs ahead of today unless somebody types a date.
   *
   * A period's end and the date a position is stated at are not the same thing.
   * Choosing "This year" in August and getting a balance sheet as at 31 December
   * is a statement about a future nobody has posted; worse, on an ageing report
   * it marks every invoice not yet due as overdue, because the comparison is
   * against a date four months away. So the default is the earlier of the two —
   * and a period wholly in the past still states its own end, which is what
   * "Last year" is asked for.
   */
  const defaultAsOf = range.to > now ? now : range.to

  return {
    period,
    range,
    basis,
    comparison,
    comparisonRange:
      comparison === 'prior-period'
        ? priorPeriod(range)
        : comparison === 'prior-year'
          ? priorYear(range)
          : undefined,
    asOf: asOfParam && isCalendarDate(asOfParam) ? asOfParam : defaultAsOf,
  }
}

/** Entity narrowing from the URL — shared by every catalogue table report. */
export function readEntityFilters(query: SearchParams): {
  customerId?: string
  vendorId?: string
  itemId?: string
  accountId?: string
  storeId?: string
} {
  const customerId = one(query.customerId)
  const vendorId = one(query.vendorId)
  const itemId = one(query.itemId)
  const accountId = one(query.accountId)
  const storeId = one(query.storeId)
  return {
    ...(customerId ? { customerId } : {}),
    ...(vendorId ? { vendorId } : {}),
    ...(itemId ? { itemId } : {}),
    ...(accountId ? { accountId } : {}),
    ...(storeId ? { storeId } : {}),
  }
}

/** The settings as plain params, for links that must keep the current period. */
export function settingsToQueryObject(settings: ReportSettings): Record<string, string> {
  return {
    period: settings.period,
    from: settings.range.from,
    to: settings.range.to,
    basis: settings.basis,
    compare: settings.comparison,
    asOf: settings.asOf,
  }
}

/** The settings as a query string, for export links and comparison switches. */
export function settingsToQuery(settings: ReportSettings, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({
    period: settings.period,
    from: settings.range.from,
    to: settings.range.to,
    basis: settings.basis,
    compare: settings.comparison,
    asOf: settings.asOf,
    ...extra,
  })
  return params.toString()
}
