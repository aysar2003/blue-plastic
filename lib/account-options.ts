import type { AccountSubtype, AccountType, SystemAccountKey } from '@prisma/client'

import { ACCOUNT_SUBTYPE_LABELS, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ORDER } from '@/lib/accounting-labels'

/**
 * Account pickers, everywhere, from one shape.
 *
 * The rule the whole application follows: **every postable account is always
 * selectable.** A screen may say which accounts it expects — a bill is normally
 * paid out of a bank account, stock value normally sits in an inventory account —
 * but it may never be the only thing on offer. A chart of accounts is the
 * business's own, and a form that hides two thirds of it is a form that forces
 * the wrong answer.
 *
 * So relevance is expressed as *ordering*, never as filtering: the expected
 * subtypes come first under a "Suggested" heading, and the rest of the chart
 * follows grouped by statement type. Every option shows what kind of account it
 * is, because "3200" and "Owner drawings" mean nothing without it.
 */
export type AccountChoice = {
  id: string
  code: string
  name: string
  type: AccountType
  subtype: AccountSubtype
  /** The role the engine posts to through this account, where it has one. */
  systemKey?: SystemAccountKey | null
  /** Natural-side balance as at today, pre-formatted. Optional. */
  balance?: string | null
}

/**
 * The subledger dimension a line against this account must carry.
 *
 * Receivables and payables are control accounts: their balance is the sum of a
 * subledger, and a line that does not say whose it is makes the aging report and
 * the trial balance disagree. R7 refuses such a line in the database, so every
 * picker that can reach one has to be able to ask for the name.
 *
 * Keyed on the subtype rather than the system role deliberately — a business
 * with two receivables accounts gets the same protection on both.
 */
export type PartyRequirement = 'customer' | 'vendor' | null

export const partyRequiredBy = (subtype: AccountSubtype): PartyRequirement =>
  subtype === 'ACCOUNTS_RECEIVABLE'
    ? 'customer'
    : subtype === 'ACCOUNTS_PAYABLE'
      ? 'vendor'
      : null

export type AccountPickerOption = {
  id: string
  label: string
  hint?: string
  group?: string
  /** Kept so a caller can react to the choice — a bank account, a stock account. */
  type: AccountType
  subtype: AccountSubtype
  /** Set when choosing this account obliges the caller to name a customer or vendor. */
  requiresParty?: PartyRequirement
  /** Natural balance, only for bank accounts, so the picker can show the money in the account. */
  balance?: string | null
}

export const SUGGESTED_GROUP = 'Suggested'

/** The money accounts every payment screen means by "which account". */
export const MONEY_SUBTYPES: AccountSubtype[] = [
  'BANK',
  'CREDIT_CARD',
  'UNDEPOSITED_FUNDS',
  'OTHER_CURRENT_ASSET',
]

/** Where a cost lands when it is not stock. */
export const COST_SUBTYPES: AccountSubtype[] = [
  'COST_OF_GOODS_SOLD',
  'OPERATING_EXPENSE',
  'OTHER_EXPENSE',
]

export type AccountOptionsConfig = {
  /** Subtypes to lift into "Suggested", in the order given. */
  prefer?: AccountSubtype[]
  /** Whole types to lift into "Suggested", after any preferred subtypes. */
  preferTypes?: AccountType[]
  /** Show the balance on the right instead of the subtype. */
  showBalance?: boolean
}

/**
 * Turn the chart into picker options: suggested first, then the whole chart by
 * statement type, each labelled `code — name` and hinted with its kind.
 */
export function accountOptions(
  accounts: AccountChoice[],
  config: AccountOptionsConfig = {},
): AccountPickerOption[] {
  const prefer = config.prefer ?? []
  const preferTypes = config.preferTypes ?? []

  const rankOf = (account: AccountChoice): number => {
    const bySubtype = prefer.indexOf(account.subtype)
    if (bySubtype >= 0) return bySubtype
    const byType = preferTypes.indexOf(account.type)
    if (byType >= 0) return prefer.length + byType
    return -1
  }

  const suggested: AccountChoice[] = []
  const rest: AccountChoice[] = []
  for (const account of accounts) (rankOf(account) >= 0 ? suggested : rest).push(account)

  suggested.sort((a, b) => rankOf(a) - rankOf(b) || a.code.localeCompare(b.code))
  rest.sort(
    (a, b) =>
      ACCOUNT_TYPE_ORDER.indexOf(a.type) - ACCOUNT_TYPE_ORDER.indexOf(b.type) ||
      a.code.localeCompare(b.code),
  )

  const toOption = (account: AccountChoice, group: string): AccountPickerOption => ({
    id: account.id,
    label: `${account.code} — ${account.name}`,
    // The hint is searched as well as shown, so typing "bank" finds the bank
    // accounts even when none of them has "bank" in its name. The kind is
    // always there: "3200" and "Owner drawings" mean nothing without it.
    hint:
      config.showBalance && account.balance != null
        ? `${ACCOUNT_SUBTYPE_LABELS[account.subtype]} · ${account.balance}`
        : ACCOUNT_SUBTYPE_LABELS[account.subtype],
    group,
    type: account.type,
    subtype: account.subtype,
    requiresParty: partyRequiredBy(account.subtype),
    balance: account.subtype === 'BANK' ? (account.balance ?? null) : null,
  })

  return [
    ...suggested.map((account) => toOption(account, SUGGESTED_GROUP)),
    ...rest.map((account) => toOption(account, ACCOUNT_TYPE_LABELS[account.type])),
  ]
}

/** The balance an option was built with, back out of its hint. */
export const balanceOf = (option: { hint?: string }): string | null => {
  const parts = option.hint?.split(' · ')
  return parts && parts.length > 1 ? parts[parts.length - 1] : null
}

/** `code — name`, the label used wherever an account is named outside a picker. */
export const accountLabel = (account: { code: string; name: string }) =>
  `${account.code} — ${account.name}`
