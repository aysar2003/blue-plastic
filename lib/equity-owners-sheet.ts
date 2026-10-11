/**
 * Owners / capital accounts sheet for distributing retained earnings after
 * year-end close. Export lists every Owner's equity account; fill Amount to
 * allocate, then import to post Dr Retained Earnings / Cr each owner.
 */

export const OWNERS_EQUITY_HEADERS = [
  'Account ID',
  'Account number',
  'Account name',
  'Detail type',
  'Balance now',
  'Share %',
  'Amount to allocate',
] as const

export type OwnersEquityImportLine = {
  accountId: string
  code: string
  name: string
  amount: string
}
