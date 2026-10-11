import 'server-only'
import type { AccountSubtype, AccountType, SystemAccountKey } from '@prisma/client'

import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'

/**
 * Which account the system posts to for each of its own roles.
 *
 * The engine never names an account: it asks for a *role* — "the receivable
 * control account", "the account uncategorised income lands in" — and this is
 * where a role is bound to an account. Every invoice, bill, payment and closing
 * entry resolves through it, so changing a binding here changes what the forms
 * do without any form knowing about it.
 *
 * The chart is seeded with a sensible binding for each role. This exists because
 * a business that already has its own chart should be able to say "our
 * receivables account is 1150, not 1100" once, rather than being told what to
 * call things.
 */
export type SystemAccountRole = {
  key: SystemAccountKey
  label: string
  /** What posts here, in the words of the person doing the posting. */
  used: string
  types: AccountType[]
  subtypes: AccountSubtype[]
}

export const SYSTEM_ACCOUNT_ROLES: SystemAccountRole[] = [
  {
    key: 'ACCOUNTS_RECEIVABLE',
    label: 'Accounts receivable',
    used: 'Every invoice debits this, and every customer payment credits it. Its balance is what customers owe.',
    types: ['ASSET'],
    subtypes: ['ACCOUNTS_RECEIVABLE'],
  },
  {
    key: 'ACCOUNTS_PAYABLE',
    label: 'Accounts payable',
    used: 'Every bill credits this, and every bill payment debits it. Its balance is what you owe vendors.',
    types: ['LIABILITY'],
    subtypes: ['ACCOUNTS_PAYABLE'],
  },
  {
    key: 'UNDEPOSITED_FUNDS',
    label: 'Undeposited funds',
    used: 'Money received but not yet banked. Cleared by recording the deposit.',
    types: ['ASSET'],
    subtypes: ['UNDEPOSITED_FUNDS', 'OTHER_CURRENT_ASSET'],
  },
  {
    key: 'INVENTORY_ASSET',
    label: 'Inventory asset',
    used: 'The value of stock on hand. Debited when stock is received, credited when it is sold.',
    types: ['ASSET'],
    subtypes: ['INVENTORY', 'OTHER_CURRENT_ASSET'],
  },
  {
    key: 'COGS',
    label: 'Cost of goods sold',
    used: 'The default cost account for a tracked item sold, when the item does not name its own.',
    types: ['EXPENSE'],
    subtypes: ['COST_OF_GOODS_SOLD'],
  },
  {
    key: 'SALES_TAX_PAYABLE',
    label: 'Sales tax payable',
    used: 'Tax charged on sales, held until it is paid to the agency.',
    types: ['LIABILITY'],
    subtypes: ['SALES_TAX_PAYABLE', 'OTHER_CURRENT_LIABILITY'],
  },
  {
    key: 'RETAINED_EARNINGS',
    label: 'Retained earnings',
    used: 'Where the year-end close sweeps the profit of a closed fiscal year.',
    types: ['EQUITY'],
    subtypes: ['RETAINED_EARNINGS', 'OWNERS_EQUITY'],
  },
  {
    key: 'OPENING_BALANCE_EQUITY',
    label: 'Opening balance equity',
    used: 'The other side of every opening balance entered during setup. Should end at zero.',
    types: ['EQUITY'],
    subtypes: ['OPENING_BALANCE_EQUITY', 'OWNERS_EQUITY'],
  },
  {
    key: 'UNCATEGORISED_INCOME',
    label: 'Uncategorised income',
    used: 'Where an invoice line lands when its item names no income account.',
    types: ['REVENUE'],
    subtypes: ['INCOME', 'OTHER_INCOME'],
  },
  {
    key: 'UNCATEGORISED_EXPENSE',
    label: 'Uncategorised expense',
    used: 'Where a bill line lands when no category is chosen.',
    types: ['EXPENSE'],
    subtypes: ['OPERATING_EXPENSE', 'OTHER_EXPENSE'],
  },
  {
    key: 'INVENTORY_SHRINKAGE',
    label: 'Inventory shrinkage',
    used: 'The difference when a stock count disagrees with the books.',
    types: ['EXPENSE'],
    subtypes: ['COST_OF_GOODS_SOLD', 'OPERATING_EXPENSE', 'OTHER_EXPENSE'],
  },
  {
    key: 'ROUNDING_DIFFERENCE',
    label: 'Rounding difference',
    used: 'The cent that appears when an allocation cannot divide exactly.',
    types: ['EXPENSE'],
    subtypes: ['OTHER_EXPENSE', 'OPERATING_EXPENSE'],
  },
  {
    key: 'EXCHANGE_GAIN_LOSS',
    label: 'Exchange gain or loss',
    used: 'Currency movement between raising a document and settling it. Unused until multi-currency is switched on.',
    types: ['EXPENSE', 'REVENUE'],
    subtypes: ['OTHER_EXPENSE', 'OTHER_INCOME'],
  },
  {
    key: 'POS_CASH_SHORT',
    label: 'POS cash short',
    used: 'When a till is closed with less cash than expected, the shortfall posts here.',
    types: ['EXPENSE'],
    subtypes: ['OPERATING_EXPENSE', 'OTHER_EXPENSE'],
  },
  {
    key: 'POS_CASH_OVER',
    label: 'POS cash over',
    used: 'When a till is closed with more cash than expected, the surplus posts here.',
    types: ['REVENUE'],
    subtypes: ['OTHER_INCOME', 'INCOME'],
  },
]

export type SystemAccountBinding = {
  role: SystemAccountRole
  account: {
    id: string
    code: string
    name: string
    type: AccountType
    isActive: boolean
  } | null
  /** Postings already sitting in the bound account. */
  entries: number
  candidates: {
    id: string
    code: string
    name: string
    type: AccountType
  }[]
}

export async function list(ctx: OrgContext): Promise<SystemAccountBinding[]> {
  const accounts = await db.ledgerAccount.findMany({
    where: { orgId: ctx.orgId },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      subtype: true,
      systemKey: true,
      isActive: true,
      _count: { select: { journalLines: true, children: true } },
    },
    orderBy: { code: 'asc' },
  })

  const bound = new Map(accounts.filter((a) => a.systemKey).map((a) => [a.systemKey!, a]))

  return SYSTEM_ACCOUNT_ROLES.map((role) => {
    const account = bound.get(role.key)

    return {
      role,
      account: account
        ? {
            id: account.id,
            code: account.code,
            name: account.name,
            type: account.type,
            isActive: account.isActive,
          }
        : null,
      entries: account?._count.journalLines ?? 0,
      candidates: accounts
        .filter(
          (candidate) =>
            candidate.isActive &&
            // A heading has sub-accounts and is not posted to.
            candidate._count.children === 0 &&
            role.types.includes(candidate.type) &&
            role.subtypes.includes(candidate.subtype),
        )
        .map((candidate) => ({
          id: candidate.id,
          code: candidate.code,
          name: candidate.name,
          type: candidate.type,
        })),
    }
  })
}

/**
 * Bind a role to a different account.
 *
 * The uniqueness of `(orgId, systemKey)` is what makes this a *move*: the key is
 * cleared from the account that holds it and set on the new one, in one
 * transaction, so there is never a moment with two receivable control accounts
 * or none.
 *
 * What this does **not** do is move the balance. Postings already made stay
 * where they were made — the ledger is a record of what happened, and rewriting
 * history to match a new preference is the one thing this system will not do.
 * The old account keeps its balance and stops receiving new entries; clearing it
 * is a journal entry, made deliberately.
 */
export async function assign(ctx: OrgContext, key: SystemAccountKey, accountId: string) {
  const role = SYSTEM_ACCOUNT_ROLES.find((entry) => entry.key === key)
  if (!role) throw notFound('System account role')

  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const account = await tx.ledgerAccount.findFirst({
      where: { id: accountId, orgId: ctx.orgId },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        subtype: true,
        isActive: true,
        systemKey: true,
        _count: { select: { children: true } },
      },
    })
    if (!account) throw notFound('Account')

    if (!account.isActive) {
      throw validation('That account is archived. Restore it first, or choose another.', {
        accountId: ['Archived accounts cannot receive postings.'],
      })
    }

    if (account._count.children > 0) {
      throw validation('That account is a heading with sub-accounts, so nothing can post to it.', {
        accountId: ['Choose one of its sub-accounts instead.'],
      })
    }

    if (!role.types.includes(account.type) || !role.subtypes.includes(account.subtype)) {
      throw validation(
        `${role.label} has to be ${role.types.join(' or ').toLowerCase()} of the right detail type — ` +
          `otherwise it lands in the wrong place on the balance sheet.`,
        { accountId: ['This account is the wrong type for that role.'] },
      )
    }

    if (account.systemKey && account.systemKey !== key) {
      throw validation(
        `${account.code} ${account.name} is already the ${account.systemKey.replaceAll('_', ' ').toLowerCase()} account. ` +
          `One account cannot hold two of the system's roles.`,
        { accountId: ['Already used for another role.'] },
      )
    }

    const previous = await tx.ledgerAccount.findUnique({
      where: { orgId_systemKey: { orgId: ctx.orgId, systemKey: key } },
      select: { id: true, code: true, name: true },
    })

    if (previous?.id === account.id) return { id: account.id, changed: false }

    if (previous) {
      await tx.ledgerAccount.update({
        where: { id: previous.id },
        // It stops being a system account, so it can now be archived or renamed
        // like any other.
        data: { systemKey: null, isSystem: false },
      })
    }

    await tx.ledgerAccount.update({
      where: { id: account.id },
      data: { systemKey: key, isSystem: true },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'LedgerAccount',
        entityId: account.id,
        action: 'UPDATE',
        before: previous ? { role: key, account: `${previous.code} ${previous.name}` } : undefined,
        after: { role: key, account: `${account.code} ${account.name}` },
      },
      meta,
    )

    return { id: account.id, changed: true }
  })
}
