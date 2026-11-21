/** Receipt note written when a pledged gift is received against a fund class. */
export function pledgeReceiptNote(input: {
  donorName?: string | null
  amount: string
  fundName?: string | null
  purpose?: string | null
}): string {
  const parts = [
    'Donor receipt',
    input.donorName?.trim() || null,
    input.amount,
    input.fundName ? `fund ${input.fundName}` : null,
    input.purpose?.trim() || null,
  ].filter(Boolean)
  return parts.join(' · ')
}

export type DonorPledgeCsvRow = {
  donorName: string
  fund: string | null
  amount: string
  status: string
  pledgedAt: string
  receiptNote: string | null
}

export function donorPledgeCsvRows(rows: DonorPledgeCsvRow[]): (string | number)[][] {
  return [
    ['Donor', 'Fund', 'Amount', 'Status', 'Pledged', 'Receipt note'],
    ...rows.map((row) => [
      row.donorName,
      row.fund ?? '',
      row.amount,
      row.status,
      row.pledgedAt,
      row.receiptNote ?? '',
    ]),
  ]
}

export type GrantBvaCsvRow = {
  fund: string
  budgeted: string
  actual: string
  encumbered: string
  remaining: string
}

export function grantBvaCsvRows(rows: GrantBvaCsvRow[]): (string | number)[][] {
  return [
    ['Fund / class', 'Budgeted', 'Actual', 'Encumbered PO', 'Remaining'],
    ...rows.map((row) => [row.fund, row.budgeted, row.actual, row.encumbered, row.remaining]),
  ]
}

/** Whether a purchase post must carry a fund / class label. */
export function requiresRestrictedFundClass(
  orgHasRestrictedClass: boolean,
  documentClassId: string | null | undefined,
  purchaseType: string,
  isDraft: boolean,
): boolean {
  if (isDraft) return false
  if (!orgHasRestrictedClass) return false
  if (purchaseType !== 'BILL' && purchaseType !== 'EXPENSE') return false
  return !documentClassId
}