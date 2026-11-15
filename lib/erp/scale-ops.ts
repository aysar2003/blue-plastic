import { LIVE_FISCAL_YEARS } from '@/lib/year-archive'

/** Suggested partition key for multi-tenant scale-out. */
export function partitionKeyForOrg(orgId: string): string {
  return `org:${orgId}`
}

/** Years kept hot before archive (re-export for tests). */
export function liveLedgerWindowYears(): number {
  return LIVE_FISCAL_YEARS
}