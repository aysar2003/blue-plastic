import { Decimal, ZERO } from '@/lib/money'

/** Accrue only unpaid interest that has not already posted an interest journal. */
export function shouldAccrueInterest(line: {
  paidAt?: Date | string | null
  interestJournalId?: string | null
  interestDue: Decimal.Value
}): boolean {
  if (line.paidAt) return false
  if (line.interestJournalId) return false
  return new Decimal(line.interestDue).greaterThan(ZERO)
}

/**
 * Collection credits after optional interest accrual.
 *
 * Accrued interest already sits on LOAN_RECEIVABLE (Dr receivable / Cr income).
 * Collecting it again as income would double-count.
 */
export function collectionCredits(line: {
  principalDue: Decimal.Value
  interestDue: Decimal.Value
  interestAccrued: boolean
}): { principal: Decimal; interestIncome: Decimal; accruedReceivable: Decimal; cash: Decimal } {
  const principal = new Decimal(line.principalDue)
  const interest = new Decimal(line.interestDue)
  if (line.interestAccrued) {
    return {
      principal,
      interestIncome: ZERO,
      accruedReceivable: interest,
      cash: principal.plus(interest),
    }
  }
  return {
    principal,
    interestIncome: interest,
    accruedReceivable: ZERO,
    cash: principal.plus(interest),
  }
}
