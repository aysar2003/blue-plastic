/** Serializable rows for the year-end closing accounts board (preview or posted). */

export type ClosingAccountKind = 'REVENUE' | 'COGS' | 'EXPENSE' | 'EQUITY'

export type ClosingAccountRow = {
  accountId: string
  code: string
  name: string
  kind: ClosingAccountKind
  /** Debit − credit balance swept (nominal accounts). Empty for Retained Earnings. */
  balanceBefore: string
  closeDebit: string
  closeCredit: string
}

export type ClosingAccountsBoard = {
  fiscalYearId: string
  year: number
  /** preview = not yet closed; posted = from the closing journal */
  mode: 'preview' | 'posted'
  journalNumber: string | null
  netIncome: string
  retainedEarningsName: string
  currency: string
  rows: ClosingAccountRow[]
}

export const CLOSING_KIND_LABEL: Record<ClosingAccountKind, string> = {
  REVENUE: 'Revenue',
  COGS: 'Cost of goods',
  EXPENSE: 'Expense',
  EQUITY: 'Retained earnings',
}
