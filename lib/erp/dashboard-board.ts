import type { HomeKpiKey } from '@/lib/dashboard-prefs'

export const DASHBOARD_TILE_KINDS = ['KPI', 'REPORT', 'SPARK'] as const
export type DashboardTileKind = (typeof DASHBOARD_TILE_KINDS)[number]

export const DASHBOARD_KPI_KEYS: HomeKpiKey[] = [
  'profitMtd',
  'openAr',
  'reorder',
  'pipeline',
  'unpaidAp',
  'followUps',
]

export const DASHBOARD_REPORT_KEYS = [
  'profit-and-loss',
  'balance-sheet',
  'trial-balance',
  'ar-aging',
  'ap-aging',
  'vat-return',
] as const

export type DashboardReportKey = (typeof DASHBOARD_REPORT_KEYS)[number]

export const DASHBOARD_SPARK_KEYS = ['cashMovement', 'profitTrend'] as const
export type DashboardSparkKey = (typeof DASHBOARD_SPARK_KEYS)[number]

export type ResolvedTile = {
  kind: DashboardTileKind
  refKey: string
  title: string
  /** Display value; null when unavailable. */
  value: string | null
  href?: string
  /** True when a numeric threshold is set and the value meets/exceeds it. */
  thresholdBreached: boolean
}

export function isDashboardTileKind(value: string): value is DashboardTileKind {
  return (DASHBOARD_TILE_KINDS as readonly string[]).includes(value)
}

export function tileTitle(kind: DashboardTileKind, refKey: string, override?: string | null): string {
  if (override?.trim()) return override.trim()
  if (kind === 'KPI') {
    const labels: Record<HomeKpiKey, string> = {
      profitMtd: 'P&L this month',
      openAr: 'Open AR',
      reorder: 'Reorder',
      pipeline: 'Pipeline',
      unpaidAp: 'Unpaid AP',
      followUps: 'Follow-ups',
    }
    return labels[refKey as HomeKpiKey] ?? refKey
  }
  if (kind === 'REPORT') {
    return refKey.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
  if (refKey === 'cashMovement') return 'Cash movement'
  if (refKey === 'profitTrend') return 'Profit trend'
  return refKey
}

export function reportHref(refKey: string): string {
  return `/reports/${refKey}`
}

/**
 * Compare a resolved numeric display (or raw number string) to an optional threshold.
 * Banner when value >= threshold (SME "watch this" cue — not a new email channel).
 */
export function thresholdBreached(value: string | null, threshold: string | null | undefined): boolean {
  if (value == null || threshold == null || threshold === '') return false
  const n = Number(String(value).replace(/[^0-9.\-]/g, ''))
  const t = Number(threshold)
  if (!Number.isFinite(n) || !Number.isFinite(t)) return false
  return n >= t
}
