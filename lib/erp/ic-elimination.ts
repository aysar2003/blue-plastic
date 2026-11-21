import { Decimal } from '@/lib/money'

export const IC_ELIM_MEMO_PREFIX = '[IC] ELIM'

export function eliminationMemo(journalANumber: string, journalBNumber: string): string {
  return `${IC_ELIM_MEMO_PREFIX} ${journalANumber} ↔ ${journalBNumber}`
}

export function isEliminationMemo(memo: string | null | undefined): boolean {
  return (memo ?? '').trim().startsWith(IC_ELIM_MEMO_PREFIX)
}

/** Posted [IC] journals that still need matching — not elimination memos. */
export function isMatchableIcMemo(memo: string | null | undefined): boolean {
  const text = (memo ?? '').trim()
  return text.startsWith('[IC]') && !isEliminationMemo(text)
}

export type ElimSide = 'debit-first' | 'credit-first'

export type ElimLine = {
  accountId: string
  debit: string
  credit: string
  description: string
}

/**
 * Balanced Dr/Cr pair on dedicated elimination accounts.
 * Opposite sides in the two companies net if a worksheet includes them.
 */
export function eliminationLines(
  amount: Decimal.Value,
  debitAccountId: string,
  creditAccountId: string,
  side: ElimSide,
): ElimLine[] {
  const amt = new Decimal(amount).abs().toFixed(4)
  const description = 'IC elimination'
  if (side === 'debit-first') {
    return [
      { accountId: debitAccountId, debit: amt, credit: '0', description },
      { accountId: creditAccountId, debit: '0', credit: amt, description },
    ]
  }
  return [
    { accountId: creditAccountId, debit: amt, credit: '0', description },
    { accountId: debitAccountId, debit: '0', credit: amt, description },
  ]
}
