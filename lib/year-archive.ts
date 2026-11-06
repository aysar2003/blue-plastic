/** Newest N fiscal years (including the current one) stay in the hot ledger. */
export const LIVE_FISCAL_YEARS = 5

export type YearArchivePackage = {
  version: 1
  kind: 'fiscal-year-archive'
  takenAt: string
  orgId: string
  fiscalYear: {
    id: string
    year: number
    startDate: string
    endDate: string
    status: string
    closingJournalId: string | null
  }
  periods: unknown[]
  journals: unknown[]
  journalLines: unknown[]
}
