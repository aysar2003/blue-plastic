/**
 * Team performance — score company users from AuditLog work signals.
 * Ranking uses recorded books activity, not clocked hours.
 */

/** Preset chips shown in the period picker. */
export const PERFORMANCE_PERIOD_DAYS = [7, 30, 90] as const

/** `0` means all recorded history (no lower date bound). */
export const PERFORMANCE_ALL_DAYS = 0

export const MAX_CUSTOM_PERFORMANCE_DAYS = 3650

export type PerformancePeriodDays = number

export const DEFAULT_PERFORMANCE_DAYS: PerformancePeriodDays = 30

/** Work actions weigh more than mere presence. */
export const PERFORMANCE_ACTION_WEIGHT: Record<string, number> = {
  POST: 5,
  APPROVE: 5,
  CLOSE_PERIOD: 5,
  CREATE: 3,
  SUBMIT: 3,
  UPDATE: 2,
  RESTORE: 2,
  DELETE: 2,
  ARCHIVE: 2,
  REVERSE: 2,
  REOPEN_PERIOD: 2,
  REJECT: 2,
  LOGIN: 1,
  LOGIN_FAILED: 0,
  LOGOUT: 0,
}

export type PerformanceBand = 'top' | 'steady' | 'low' | 'inactive'

export const PERFORMANCE_BAND_LABEL: Record<PerformanceBand, string> = {
  top: 'Hard work',
  steady: 'Steady',
  low: 'Low activity',
  inactive: 'Inactive',
}

export const PERFORMANCE_BAND_HINT: Record<PerformanceBand, string> = {
  top: 'Well above the team median for this period',
  steady: 'Near the team median',
  low: 'Below half the team median',
  inactive: 'No recorded work actions in this period',
}

export function isAllPerformanceDays(days: number): boolean {
  return days === PERFORMANCE_ALL_DAYS
}

/**
 * Lower bound for queries.
 * `All` uses a long practical window (~10y) so Postgres keeps an indexable
 * `at >= …` predicate — unbounded scans time out on the console.
 */
export function performancePeriodStart(days: PerformancePeriodDays): Date {
  const span = isAllPerformanceDays(days) ? MAX_CUSTOM_PERFORMANCE_DAYS : days
  const start = new Date()
  start.setUTCDate(start.getUTCDate() - span)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

/** Days to fill on sparkline calendars when viewing all history. */
export const PERFORMANCE_ALL_CHART_DAYS = 365

export function performanceChartDays(days: PerformancePeriodDays): number {
  return isAllPerformanceDays(days) ? PERFORMANCE_ALL_CHART_DAYS : days
}

export function performancePeriodLabel(days: PerformancePeriodDays): string {
  if (isAllPerformanceDays(days)) return 'all time'
  return `${days} days`
}

export function performancePeriodShortLabel(days: PerformancePeriodDays): string {
  if (isAllPerformanceDays(days)) return 'All'
  return `${days}d`
}

export function parsePerformanceDays(raw: string | null | undefined): PerformancePeriodDays {
  if (raw == null || raw === '') return DEFAULT_PERFORMANCE_DAYS
  const trimmed = String(raw).trim().toLowerCase()
  if (trimmed === 'all' || trimmed === '0') return PERFORMANCE_ALL_DAYS
  const n = Number(trimmed)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return DEFAULT_PERFORMANCE_DAYS
  if (n === PERFORMANCE_ALL_DAYS) return PERFORMANCE_ALL_DAYS
  if (n >= 1 && n <= MAX_CUSTOM_PERFORMANCE_DAYS) return n
  return DEFAULT_PERFORMANCE_DAYS
}

export function actionWeight(action: string): number {
  return PERFORMANCE_ACTION_WEIGHT[action] ?? 0
}

export function isWorkAction(action: string): boolean {
  return action !== 'LOGIN' && action !== 'LOGIN_FAILED' && action !== 'LOGOUT'
}

/**
 * Relative bands vs company median of members who have any work score.
 * Inactive = zero work actions (logins alone do not count as work).
 */
export function assignPerformanceBand(input: {
  score: number
  workActions: number
  activeDays: number
  medianScore: number
}): PerformanceBand {
  if (input.workActions <= 0) return 'inactive'
  if (input.medianScore <= 0) {
    return input.score > 0 ? 'steady' : 'inactive'
  }
  if (input.score >= input.medianScore * 1.5 && input.activeDays >= 3) return 'top'
  if (input.score < input.medianScore * 0.5) return 'low'
  return 'steady'
}

export function medianOf(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2
  }
  return sorted[mid]!
}
