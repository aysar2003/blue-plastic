import 'server-only'

import { capTable } from '@/lib/erp/cap-table'
import { Decimal } from '@/lib/money'
import { toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { postJournal } from '@/server/accounting/posting'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'

export async function list(ctx: OrgContext) {
  return listShareholders(ctx)
}

export async function listShareholders(ctx: OrgContext) {
  assertPermission(ctx, 'journal:read')
  const rows = await db.shareholder.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { name: 'asc' },
    include: {
      capitalAccount: { select: { id: true, code: true, name: true } },
    },
  })
  const table = capTable(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      shares: new Decimal(row.shares.toString()),
    })),
  )
  const byId = new Map(table.map((row) => [row.id, row]))
  return rows.map((row) => {
    const computed = byId.get(row.id)
    return {
      ...row,
      shares: row.shares.toString(),
      ownershipPercent: (computed?.ownershipPercent ?? new Decimal(row.ownershipPercent)).toFixed(4),
    }
  })
}

export async function upsertShareholder(
  ctx: OrgContext,
  input: {
    id?: string | null
    name: string
    shares: string
    ownershipPercent: string
    capitalAccountId?: string | null
    notes?: string | null
  },
) {
  assertPermission(ctx, 'journal:post')
  const shares = new Decimal(input.shares || 0)
  const others = await db.shareholder.findMany({
    where: {
      orgId: ctx.orgId,
      ...(input.id ? { id: { not: input.id } } : {}),
    },
    select: { id: true, name: true, shares: true },
  })
  const computed = capTable([
    ...others.map((row) => ({
      id: row.id,
      name: row.name,
      shares: new Decimal(row.shares.toString()),
    })),
    { id: input.id || 'new', name: input.name.trim(), shares },
  ])
  const self = computed.find((row) => row.id === (input.id || 'new'))
  const data = {
    name: input.name.trim(),
    shares: shares.toFixed(4),
    ownershipPercent: (self?.ownershipPercent ?? new Decimal(input.ownershipPercent || 0)).toFixed(4),
    capitalAccountId: input.capitalAccountId || null,
    notes: input.notes?.trim() || null,
  }
  let saved: { id: string; name: string }
  if (input.id) {
    const existing = await db.shareholder.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!existing) throw notFound('Shareholder')
    saved = await db.shareholder.update({
      where: { id: input.id },
      data,
      select: { id: true, name: true },
    })
  } else {
    saved = await db.shareholder.create({
      data: { orgId: ctx.orgId, ...data },
      select: { id: true, name: true },
    })
  }

  const all = await db.shareholder.findMany({
    where: { orgId: ctx.orgId },
    select: { id: true, name: true, shares: true },
  })
  const table = capTable(
    all.map((row) => ({
      id: row.id,
      name: row.name,
      shares: new Decimal(row.shares.toString()),
    })),
  )
  await Promise.all(
    table.map((row) =>
      db.shareholder.update({
        where: { id: row.id },
        data: { ownershipPercent: row.ownershipPercent.toFixed(4) },
      }),
    ),
  )
  return saved
}

export async function postEquityEvent(
  ctx: OrgContext,
  input: {
    kind: 'CONTRIBUTION' | 'DRAW' | 'DIVIDEND'
    date: CalendarDate
    amount: string
    bankAccountId: string
    equityAccountId: string
    shareholderId?: string | null
    memo?: string | null
  },
) {
  assertPermission(ctx, 'journal:post')
  const amount = new Decimal(input.amount)
  if (amount.lessThanOrEqualTo(0)) throw validation('Amount must be greater than zero.')

  return db.$transaction(async (tx) => {
    const bank = await tx.ledgerAccount.findFirst({
      where: { id: input.bankAccountId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    })
    if (!bank) throw notFound('Bank account')
    const equity = await tx.ledgerAccount.findFirst({
      where: { id: input.equityAccountId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    })
    if (!equity) throw notFound('Equity account')

    const memo =
      input.memo?.trim() ||
      (input.kind === 'CONTRIBUTION'
        ? 'Owner contribution'
        : input.kind === 'DRAW'
          ? 'Owner draw'
          : 'Dividend')

    // Contribution: Dr Bank Cr Equity. Draw/Dividend: Dr Equity Cr Bank.
    const lines =
      input.kind === 'CONTRIBUTION'
        ? [
            { accountId: bank.id, debit: amount, description: memo },
            { accountId: equity.id, credit: amount, description: memo },
          ]
        : [
            { accountId: equity.id, debit: amount, description: memo },
            { accountId: bank.id, credit: amount, description: memo },
          ]

    const journal = await postJournal(tx, ctx, {
      date: input.date,
      memo,
      sourceType: 'MANUAL',
      lines,
    })

    const event = await tx.equityEvent.create({
      data: {
        orgId: ctx.orgId,
        shareholderId: input.shareholderId || null,
        kind: input.kind,
        date: toDate(input.date),
        amount: amount.toFixed(4),
        memo,
        bankAccountId: bank.id,
        equityAccountId: equity.id,
        journalId: journal.id,
      },
      select: { id: true, kind: true },
    })

    return { ...event, journalId: journal.id }
  })
}

export async function listEquityEvents(ctx: OrgContext) {
  assertPermission(ctx, 'journal:read')
  const rows = await db.equityEvent.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    include: {
      shareholder: { select: { id: true, name: true } },
    },
  })
  return rows.map((row) => ({
    ...row,
    amount: row.amount.toString(),
    date: toCalendarDate(row.date),
  }))
}
