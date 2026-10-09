import { Decimal } from '@/lib/money'

/**
 * Where a POS receipt's money is posted.
 *
 * `depositLedgerAccountId` is the register's bank account, stored on the order
 * when the sale is rung up. Payment rows keep the wallet account so the orders
 * report can still total by wallet. Older orders leave this null and keep
 * posting to those wallet accounts — their journals are not rewritten.
 */
export function posPostedAccounts<T extends { accountId: string }>(input: {
  depositLedgerAccountId: string | null
  payments: T[]
  change: T | null
}): { payments: T[]; change: T | null } {
  const till = input.depositLedgerAccountId
  if (!till) return { payments: input.payments, change: input.change }
  return {
    payments: input.payments.map((payment) => ({ ...payment, accountId: till })),
    change: input.change ? { ...input.change, accountId: till } : null,
  }
}

/** Who may move money out of one register. Nothing moves on its own. */
export function canTransferRegister(input: {
  canManage: boolean
  canSell: boolean
  staffUserIds: string[]
  userId: string
}): boolean {
  if (input.canManage) return true
  if (!input.canSell) return false
  if (input.staffUserIds.length === 0) return true
  return input.staffUserIds.includes(input.userId)
}

export function transferFitsBalance(amount: Decimal, balance: Decimal): 'ok' | 'empty' | 'over' | 'nonpositive' {
  if (!amount.gt(0)) return 'nonpositive'
  if (!balance.gt(0)) return 'empty'
  if (amount.gt(balance)) return 'over'
  return 'ok'
}
