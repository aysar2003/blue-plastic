import type { AccountType } from '@prisma/client'

/** The chart filter from the account list: one choice, applied to the rows in hand. */
export const ACCOUNT_VIEWS = [
  { value: '', label: 'All' },
  { value: 'mine', label: 'Created by you' },
  { value: 'balance', label: 'Balance sheet accounts' },
  { value: 'profit', label: 'Profit and loss accounts' },
  { value: 'locked', label: 'Locked accounts only' },
  { value: 'unlocked', label: 'Unlocked accounts only' },
  { value: 'parents', label: 'Parent accounts only' },
  { value: 'children', label: 'Subaccounts only' },
] as const

export type AccountView = (typeof ACCOUNT_VIEWS)[number]['value']

const BALANCE_SHEET = new Set<AccountType>(['ASSET', 'LIABILITY', 'EQUITY'])
const PROFIT_AND_LOSS = new Set<AccountType>(['REVENUE', 'EXPENSE'])

export function parseAccountView(value: string | undefined): AccountView {
  return ACCOUNT_VIEWS.some((view) => view.value === value) ? (value as AccountView) : ''
}

export type AccountViewShape = {
  type: AccountType
  isSystem: boolean
  hasChildren: boolean
  parentId: string | null
}

/**
 * Locked accounts are the system accounts: they cannot be deleted or repurposed.
 * "Created by you" and "unlocked" are the accounts a person added to the chart.
 */
export function accountMatchesView(account: AccountViewShape, view: AccountView): boolean {
  switch (view) {
    case 'mine':
    case 'unlocked':
      return !account.isSystem
    case 'locked':
      return account.isSystem
    case 'balance':
      return BALANCE_SHEET.has(account.type)
    case 'profit':
      return PROFIT_AND_LOSS.has(account.type)
    case 'parents':
      return account.hasChildren
    case 'children':
      return account.parentId != null
    default:
      return true
  }
}
