import 'server-only'
import type { AccountType, Prisma } from '@prisma/client'

import type { AccountChoice } from '@/lib/account-options'
import { Decimal, toMoneyString } from '@/lib/money'
import { today } from '@/lib/date'
import type { AccountCreateInput, AccountUpdateInput } from '@/lib/validation/accounting'
import { balancesAsOf } from '@/server/accounting/balances'
import { seedChartOfAccounts, systemAccountId } from '@/server/accounting/chart-of-accounts'
import { seedPaymentTerms } from '@/server/services/tax.service'
import { postJournal } from '@/server/accounting/posting'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'

const ACCOUNT_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  type: true,
  subtype: true,
  detailType: true,
  parentId: true,
  systemKey: true,
  isSystem: true,
  isActive: true,
  currencyCode: true,
} satisfies Prisma.LedgerAccountSelect

export type AccountRow = Prisma.LedgerAccountGetPayload<{ select: typeof ACCOUNT_SELECT }> & {
  balance: string
  hasChildren: boolean
  depth: number
}

/**
 * The whole chart, ordered by account number within statement type, each account
 * carrying its balance as at today.
 *
 * The chart is small — a few hundred rows at most, for any business — so it is
 * fetched whole and shaped in memory rather than paginated. A chart of accounts
 * that arrives one page at a time is unusable: an accountant reads it as a tree.
 */
export async function list(
  ctx: OrgContext,
  options: { includeInactive?: boolean; q?: string } = {},
): Promise<AccountRow[]> {
  const accounts = await db.ledgerAccount.findMany({
    where: {
      orgId: ctx.orgId,
      ...(options.includeInactive ? {} : { isActive: true }),
      ...(options.q
        ? {
            OR: [
              { code: { contains: options.q, mode: 'insensitive' } },
              { name: { contains: options.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: ACCOUNT_SELECT,
    orderBy: [{ type: 'asc' }, { code: 'asc' }],
  })

  const balances = await balancesAsOf(ctx.orgId, today(ctx.organization.timeZone))
  const childCount = new Map<string, number>()
  for (const account of accounts) {
    if (account.parentId) childCount.set(account.parentId, (childCount.get(account.parentId) ?? 0) + 1)
  }

  const byId = new Map(accounts.map((account) => [account.id, account]))
  const depthOf = (account: (typeof accounts)[number]): number => {
    let depth = 0
    let current = account.parentId
    while (current && depth < 8) {
      depth += 1
      current = byId.get(current)?.parentId ?? null
    }
    return depth
  }

  return accounts.map((account) => ({
    ...account,
    balance: toMoneyString(balances.get(account.id)?.natural ?? 0, 2),
    hasChildren: (childCount.get(account.id) ?? 0) > 0,
    depth: depthOf(account),
  }))
}

export async function get(ctx: OrgContext, id: string) {
  const account = await db.ledgerAccount.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      ...ACCOUNT_SELECT,
      parent: { select: { id: true, code: true, name: true } },
      _count: { select: { children: true, journalLines: true } },
    },
  })
  if (!account) throw notFound('Account')
  return account
}

/**
 * Install the default chart. Available while the chart is empty, and re-runnable
 * later to pick up system accounts added by a newer release.
 */
export async function installDefaultChart(ctx: OrgContext) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const result = await seedChartOfAccounts(tx, ctx.orgId)
    // The standard terms come with the standard chart: nobody should have to
    // type "Net 30" before they can raise their first invoice.
    await seedPaymentTerms(tx, ctx.orgId)

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'LedgerAccount',
        entityId: ctx.orgId,
        action: 'CREATE',
        after: { installedDefaultChart: result.created },
      },
      meta,
    )

    return result
  })
}

export async function create(ctx: OrgContext, input: AccountCreateInput) {
  const meta = await requestMeta()

  const duplicate = await db.ledgerAccount.findUnique({
    where: { orgId_code: { orgId: ctx.orgId, code: input.code } },
    select: { name: true },
  })
  if (duplicate) {
    throw validation(`Account number ${input.code} is already used by "${duplicate.name}".`, {
      code: [`Already used by "${duplicate.name}".`],
    })
  }

  await assertParentIsUsable(ctx, input.parentId ?? null, input.type)

  return db.$transaction(async (tx) => {
    const account = await tx.ledgerAccount.create({
      data: {
        orgId: ctx.orgId,
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        subtype: input.subtype,
        detailType: input.detailType ?? null,
        parentId: input.parentId ?? null,
      },
      select: ACCOUNT_SELECT,
    })

    await writeAudit(
      tx,
      ctx,
      { entity: 'LedgerAccount', entityId: account.id, action: 'CREATE', after: account },
      meta,
    )

    // An opening balance is a journal like any other: this account against
    // Opening Balance Equity. Nothing writes a balance directly.
    if (input.openingBalance && !new Decimal(input.openingBalance).isZero()) {
      const amount = new Decimal(input.openingBalance)
      const obe = await systemAccountId(tx, ctx.orgId, 'OPENING_BALANCE_EQUITY')
      const date = input.openingBalanceDate ?? today(ctx.organization.timeZone)

      // A positive figure means "this account's natural balance", so an asset is
      // debited and a liability credited. Entering -500 for a bank account
      // overdraft does the opposite.
      const debitsAccount = amount.isPositive() === isDebitNormal(input.type)
      const magnitude = amount.abs()

      await postJournal(tx, ctx, {
        date,
        memo: `Opening balance — ${account.code} ${account.name}`,
        sourceType: 'OPENING_BALANCE',
        sourceId: account.id,
        lines: debitsAccount
          ? [
              { accountId: account.id, debit: magnitude },
              { accountId: obe, credit: magnitude },
            ]
          : [
              { accountId: obe, debit: magnitude },
              { accountId: account.id, credit: magnitude },
            ],
      })
    }

    return account
  })
}

export async function update(ctx: OrgContext, input: AccountUpdateInput) {
  const meta = await requestMeta()

  const before = await db.ledgerAccount.findFirst({
    where: { id: input.id, orgId: ctx.orgId },
    select: ACCOUNT_SELECT,
  })
  if (!before) throw notFound('Account')

  if (before.code !== input.code) {
    const duplicate = await db.ledgerAccount.findUnique({
      where: { orgId_code: { orgId: ctx.orgId, code: input.code } },
      select: { id: true, name: true },
    })
    if (duplicate && duplicate.id !== input.id) {
      throw validation(`Account number ${input.code} is already used by "${duplicate.name}".`, {
        code: [`Already used by "${duplicate.name}".`],
      })
    }
  }

  if (input.parentId !== before.parentId) {
    await assertParentIsUsable(ctx, input.parentId ?? null, before.type, input.id)
  }

  return db.$transaction(async (tx) => {
    const after = await tx.ledgerAccount.update({
      where: { id: input.id },
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        detailType: input.detailType ?? null,
        parentId: input.parentId ?? null,
      },
      select: ACCOUNT_SELECT,
    })

    await writeAudit(
      tx,
      ctx,
      { entity: 'LedgerAccount', entityId: after.id, action: 'UPDATE', before, after },
      meta,
    )

    return after
  })
}

/**
 * Archive or restore. Accounts are never deleted: a posted line references them
 * forever, and a ledger that cannot name the account a figure was posted to is
 * not a ledger.
 */
export async function setActive(ctx: OrgContext, id: string, isActive: boolean) {
  const meta = await requestMeta()

  const account = await db.ledgerAccount.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { ...ACCOUNT_SELECT, _count: { select: { children: true } } },
  })
  if (!account) throw notFound('Account')

  if (account.isSystem) {
    throw precondition(
      `${account.name} is a system account. The engine posts to it by name, so it cannot be archived.`,
    )
  }

  if (!isActive) {
    const balances = await balancesAsOf(ctx.orgId, today(ctx.organization.timeZone))
    const balance = balances.get(id)?.natural ?? new Decimal(0)
    if (!balance.isZero()) {
      throw precondition(
        `${account.code} ${account.name} still has a balance of ${toMoneyString(balance, 2)}. ` +
          `Move it to another account before archiving, or the balance sheet will hide it.`,
      )
    }

    const activeChildren = await db.ledgerAccount.count({
      where: { orgId: ctx.orgId, parentId: id, isActive: true },
    })
    if (activeChildren > 0) {
      throw precondition('Archive or move its sub-accounts first.')
    }
  }

  return db.$transaction(async (tx) => {
    const after = await tx.ledgerAccount.update({
      where: { id },
      data: { isActive },
      select: ACCOUNT_SELECT,
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'LedgerAccount',
        entityId: id,
        action: isActive ? 'RESTORE' : 'ARCHIVE',
        before: { isActive: account.isActive },
        after: { isActive },
      },
      meta,
    )

    return after
  })
}

/** Accounts that can actually receive a posting: active, and not a grouping heading. */
export async function postableAccounts(ctx: OrgContext) {
  const accounts = await db.ledgerAccount.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: {
      id: true, code: true, name: true, type: true, subtype: true, parentId: true, systemKey: true,
    },
    orderBy: [{ code: 'asc' }],
  })

  const parents = new Set(accounts.map((a) => a.parentId).filter(Boolean) as string[])
  return accounts.filter((account) => !parents.has(account.id))
}

async function assertParentIsUsable(
  ctx: OrgContext,
  parentId: string | null,
  type: AccountType,
  selfId?: string,
) {
  if (!parentId) return

  if (parentId === selfId) {
    throw validation('An account cannot be its own parent.', { parentId: ['Choose a different parent.'] })
  }

  const parent = await db.ledgerAccount.findFirst({
    where: { id: parentId, orgId: ctx.orgId },
    select: { id: true, type: true, parentId: true, name: true },
  })
  if (!parent) throw notFound('Parent account')

  if (parent.type !== type) {
    throw validation(
      `A sub-account must sit under a parent of the same type. "${parent.name}" is a different type.`,
      { parentId: ['Choose a parent of the same type.'] },
    )
  }

  // Walk up to catch a cycle before the database has to.
  if (selfId) {
    let cursor: string | null = parent.parentId
    let hops = 0
    while (cursor && hops < 8) {
      if (cursor === selfId) {
        throw conflict('That would make the account a descendant of itself.')
      }
      const next: { parentId: string | null } | null = await db.ledgerAccount.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      })
      cursor = next?.parentId ?? null
      hops += 1
    }
  }
}

const isDebitNormal = (type: AccountType) => type === 'ASSET' || type === 'EXPENSE'

/**
 * The chart as a picker offers it: every postable account, with its kind and —
 * when asked — its balance as at today.
 *
 * One loader for every account selector in the application. Screens say which
 * accounts they *expect* by ordering (`lib/account-options.ts`); none of them
 * filters the chart down, because an account the business created and cannot
 * choose is worse than no account at all.
 */
export async function selectableAccounts(
  ctx: OrgContext,
  options: { withBalances?: boolean } = {},
): Promise<AccountChoice[]> {
  const accounts = await postableAccounts(ctx)

  const balances = options.withBalances
    ? await balancesAsOf(ctx.orgId, today(ctx.organization.timeZone))
    : null

  return accounts.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    subtype: account.subtype,
    systemKey: account.systemKey,
    balance: balances ? toMoneyString(balances.get(account.id)?.natural ?? 0, 2) : null,
  }))
}

/**
 * Bring a chart in from a spreadsheet.
 *
 * Columns: code, name, type, subtype, and optionally detail, description,
 * openingBalance, openingBalanceDate. `type` is ASSET, LIABILITY, EQUITY,
 * REVENUE or EXPENSE. `subtype` is the detail type the reports already group
 * on, such as OPERATING_EXPENSE or INCOME. Each row is created through the
 * same path as the New account dialog, including its opening balance journal.
 */
export async function importChart(ctx: OrgContext, csv: string) {
  const { parseCsv, pick } = await import('@/lib/csv')
  const { accountCreateSchema } = await import('@/lib/validation/accounting')
  const { rows } = parseCsv(csv)
  const issues: { row: number; message: string }[] = []
  let created = 0

  for (const [index, row] of rows.entries()) {
    const subtype = (pick(row, 'subtype', 'detailType') || '').trim().toUpperCase().replace(/[\s-]+/g, '_')
    const parsed = accountCreateSchema.safeParse({
      code: pick(row, 'code', 'number', 'accountNumber'),
      name: pick(row, 'name', 'account'),
      type: (pick(row, 'type') || '').trim().toUpperCase(),
      subtype,
      detailType: pick(row, 'detail', 'furtherDetail'),
      description: pick(row, 'description'),
      openingBalance: pick(row, 'openingBalance', 'balance'),
      openingBalanceDate: pick(row, 'openingBalanceDate', 'asAt', 'date'),
    })
    if (!parsed.success) {
      issues.push({ row: index + 2, message: parsed.error.issues[0]?.message ?? 'Could not read this row' })
      continue
    }
    try {
      await create(ctx, parsed.data)
      created += 1
    } catch (error) {
      issues.push({
        row: index + 2,
        message: error instanceof Error ? error.message : 'Could not create this account',
      })
    }
  }

  return { created, issues, total: rows.length }
}
