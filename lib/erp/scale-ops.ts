import { LIVE_FISCAL_YEARS } from '@/lib/year-archive'

/** Suggested partition key for multi-tenant scale-out. */
export function partitionKeyForOrg(orgId: string): string {
  return `org:${orgId}`
}

/** Years kept hot before archive (re-export for tests). */
export function liveLedgerWindowYears(): number {
  return LIVE_FISCAL_YEARS
}

export const REPORT_PACK_LIVE_YEAR_WARNING =
  'Scheduled report packs and KPI snapshots should target live fiscal years only. Archived years are not in the hot ledger.'

export function liveYearWindowLabel(
  liveFromYear: number,
  currentFiscalYear: number,
  windowYears: number = liveLedgerWindowYears(),
): string {
  return `FY ${liveFromYear}–${currentFiscalYear} (${windowYears}-year live window)`
}