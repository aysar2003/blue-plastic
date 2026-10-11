import { Decimal } from '@/lib/money'

/**
 * Where a POS receipt's money is posted.
 *
 * When the till has a register bank account under POS Banks, every tender and
 * change line posts there — cash, EVC, Edahab, the lot. Payment rows still keep
 * the method wallet id for the orders report. Older orders with a null deposit
 * account stay on the wallet accounts they were posted to.
 */
export function posPostedAccounts<T extends { accountId: string; isCash?: boolean }>(input: {
  depositLedgerAccountId: string | null
  payments: T[]
  change: T | null
}): { payments: T[]; change: T | null } {
  const till = input.depositLedgerAccountId
  if (!till) return { payments: input.payments, change: input.change }

  const toAccount = <R extends { accountId: string }>(row: R): R => ({ ...row, accountId: till })

  return {
    payments: input.payments.map(toAccount),
    change: input.change ? toAccount(input.change) : null,
  }
}

/**
 * Who may open, sell on, or close a counter.
 * Managers may use any till. Cashiers may only use counters they are assigned to.
 * An empty staff list means managers only — assign staff in POS settings.
 */
export function canUseRegister(input: {
  canManage: boolean
  staffUserIds: string[]
  userId: string
}): boolean {
  if (input.canManage) return true
  return input.staffUserIds.includes(input.userId)
}

/** Who may move money out of one register. Same staff rule as selling. */
export function canTransferRegister(input: {
  canManage: boolean
  canSell: boolean
  staffUserIds: string[]
  userId: string
}): boolean {
  if (!input.canSell && !input.canManage) return false
  return canUseRegister({
    canManage: input.canManage,
    staffUserIds: input.staffUserIds,
    userId: input.userId,
  })
}

export function transferFitsBalance(amount: Decimal, balance: Decimal): 'ok' | 'empty' | 'over' | 'nonpositive' {
  if (!amount.gt(0)) return 'nonpositive'
  if (!balance.gt(0)) return 'empty'
  if (amount.gt(balance)) return 'over'
  return 'ok'
}
