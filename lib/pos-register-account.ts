/**
 * Chart-of-accounts plan for POS register bank accounts.
 *
 * Each till gets a BANK sub-account under one "POS Banks" heading so the
 * register accounts sit together on the chart. The heading is identified by
 * detail type, and each register account by the description
 * `POS register <id>`, which stays put when the till is renamed.
 *
 * Wallet payment methods keep their own ledger accounts. These register
 * accounts are the grouped bank destinations; sales receipts still debit the
 * wallet that took the money.
 */

export const POS_BANKS_NAME = 'POS Banks'
export const POS_BANKS_DETAIL = 'POS Banks'
export const POS_BANKS_DESCRIPTION =
  'Heading for each POS register bank account. Post to a register sub-account, not here.'

export const POS_REGISTER_DETAIL = 'POS register'

/** First asset number tried for the heading, so it sits after Bank Account (1010). */
export const POS_BANKS_CODE_START = 1020
const ASSET_CODE_END = 1999

export function posRegisterAccountDescription(registerId: string): string {
  return `POS register ${registerId}`
}

export type PosRegisterAccountRow = {
  id: string
  code: string
  name: string
  description: string | null
  detailType: string | null
  parentId: string | null
}

export type PosRegisterRow = {
  id: string
  name: string
  ledgerAccountId: string | null
}

export type PosRegisterAccountAction =
  | { type: 'create-parent'; code: string }
  | {
      type: 'create-account'
      registerId: string
      code: string
      name: string
      description: string
    }
  | { type: 'link'; registerId: string; accountId: string }
  | { type: 'rename'; accountId: string; name: string }
  | { type: 'retag'; accountId: string }
  | { type: 'attach-parent'; accountId: string }

export class PosRegisterAccountPlanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PosRegisterAccountPlanError'
  }
}

function nextFreeCode(used: Set<string>, start: number): string {
  let number = start
  while (number <= ASSET_CODE_END && used.has(String(number))) number += 1
  if (number > ASSET_CODE_END) {
    throw new PosRegisterAccountPlanError(
      'There is no free account number left beside POS Banks (1000–1999).',
    )
  }
  return String(number)
}

function numericCode(code: string): number | null {
  return /^[0-9]+$/.test(code) ? Number(code) : null
}

/**
 * What to write so every register has a bank sub-account under POS Banks.
 * A second call with the result applied returns nothing.
 */
export function planPosRegisterAccounts(
  accounts: PosRegisterAccountRow[],
  registers: PosRegisterRow[],
): PosRegisterAccountAction[] {
  if (registers.length === 0) return []

  const used = new Set(accounts.map((account) => account.code))
  const byId = new Map(accounts.map((account) => [account.id, account]))
  const parent = accounts.find((account) => account.detailType === POS_BANKS_DETAIL)
  const actions: PosRegisterAccountAction[] = []

  const ordered = [...registers].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  )

  const owned = (register: PosRegisterRow): PosRegisterAccountRow | undefined => {
    const description = posRegisterAccountDescription(register.id)
    if (register.ledgerAccountId) {
      const linked = byId.get(register.ledgerAccountId)
      if (linked) return linked
    }
    return accounts.find((account) => account.description === description)
  }

  const needsHeading = ordered.some((register) => {
    const account = owned(register)
    if (!account) return true
    return (
      account.description === posRegisterAccountDescription(register.id) && account.parentId == null
    )
  })

  let parentCode = parent?.code ?? null
  if (!parent && needsHeading) {
    parentCode = nextFreeCode(used, POS_BANKS_CODE_START)
    used.add(parentCode)
    actions.push({ type: 'create-parent', code: parentCode })
  }

  const childStart = (parentCode ? numericCode(parentCode) : null) ?? POS_BANKS_CODE_START

  for (const register of ordered) {
    const description = posRegisterAccountDescription(register.id)
    const linked = register.ledgerAccountId ? byId.get(register.ledgerAccountId) : undefined
    const byDescription = accounts.find((account) => account.description === description)
    const account = linked ?? byDescription

    if (!account) {
      const code = nextFreeCode(used, childStart + 1)
      used.add(code)
      actions.push({
        type: 'create-account',
        registerId: register.id,
        code,
        name: register.name,
        description,
      })
      continue
    }

    if (!linked && byDescription) {
      actions.push({ type: 'link', registerId: register.id, accountId: byDescription.id })
    }

    if (account.description !== description) continue

    if (account.name !== register.name) {
      actions.push({ type: 'rename', accountId: account.id, name: register.name })
    }
    if (account.detailType !== POS_REGISTER_DETAIL) {
      actions.push({ type: 'retag', accountId: account.id })
    }
    if (account.parentId == null) {
      actions.push({ type: 'attach-parent', accountId: account.id })
    }
  }

  return actions
}
