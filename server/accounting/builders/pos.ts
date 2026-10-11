import 'server-only'

import { Decimal } from '@/lib/money'
import type { CalendarDate } from '@/lib/date'
import type { DraftJournal } from '@/server/accounting/posting'

/**
 * POS cash-control journals (Odoo-style session and drawer moves).
 */

/** Cash put into / taken from the till against another money account. */
export function buildPosCashMoveJournal(input: {
  date: CalendarDate
  kind: 'IN' | 'OUT'
  movementId: string
  registerAccountId: string
  counterpartyAccountId: string
  amount: Decimal.Value
  registerName: string
  reason?: string | null
}): DraftJournal {
  const amount = new Decimal(input.amount)
  const label =
    input.kind === 'IN'
      ? `POS cash in · ${input.registerName}`
      : `POS cash out · ${input.registerName}`
  const memo = input.reason?.trim() || label

  // IN:  Dr till, Cr source (cash arrives from bank / safe)
  // OUT: Dr destination, Cr till (cash leaves the drawer)
  const lines =
    input.kind === 'IN'
      ? [
          { accountId: input.registerAccountId, debit: amount, description: label },
          { accountId: input.counterpartyAccountId, credit: amount, description: label },
        ]
      : [
          { accountId: input.counterpartyAccountId, debit: amount, description: label },
          { accountId: input.registerAccountId, credit: amount, description: label },
        ]

  return {
    date: input.date,
    memo,
    sourceType: 'POS_CASH_MOVE',
    sourceId: input.movementId,
    idempotencyKey: `pos-cash-move:${input.movementId}`,
    lines,
  }
}

/**
 * Session close cash difference.
 * Short (counted < expected): Dr cash short expense, Cr till.
 * Over  (counted > expected): Dr till, Cr cash over income.
 */
export function buildPosSessionCloseJournal(input: {
  date: CalendarDate
  sessionId: string
  registerAccountId: string
  differenceAccountId: string
  amount: Decimal.Value
  registerName: string
  over: boolean
}): DraftJournal | null {
  const amount = new Decimal(input.amount).abs()
  if (amount.isZero()) return null

  const label = input.over
    ? `POS cash over · ${input.registerName}`
    : `POS cash short · ${input.registerName}`

  const lines = input.over
    ? [
        { accountId: input.registerAccountId, debit: amount, description: label },
        { accountId: input.differenceAccountId, credit: amount, description: label },
      ]
    : [
        { accountId: input.differenceAccountId, debit: amount, description: label },
        { accountId: input.registerAccountId, credit: amount, description: label },
      ]

  return {
    date: input.date,
    memo: label,
    sourceType: 'POS_SESSION_CLOSE',
    sourceId: input.sessionId,
    idempotencyKey: `pos-session-close:${input.sessionId}`,
    lines,
  }
}
