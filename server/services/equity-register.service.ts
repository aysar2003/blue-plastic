import 'server-only'

import type { AccountSubtype, EquityEventKind } from '@prisma/client'

import { today, toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import {
  equityEventCreditsEquity,
  equityEventStatementSubtype,
  equityMovementCsv,
  shareholderRegisterCsv,
  type EquityMovementRow,
} from '@/lib/erp/equity-csv'
import { Decimal } from '@/lib/money'
import { postJournal } from '@/server/accounting/posting'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'

async function accountBySubtype(ctx: OrgContext, subtype: AccountSubtype) {
  const preferred =
    subtype === 'OWNERS_EQUITY'
      ? await db.ledgerAccount.findFirst({
          where: { orgId: ctx.orgId, isActive: true, subtype, code: '3000' },
          select: { id: true },
        })
      : subtype === 'RETAINED_EARNINGS'
        ? await db.ledgerAccount.findFirst({
            where: { orgId: ctx.orgId, isActive: true, systemKey: 'RETAINED_EARNINGS' },
            select: { id: true },
          })
        : null
  return (
    preferred ??
    (await db.ledgerAccount.findFirst({
      where: { orgId: ctx.orgId, isActive: true, subtype },
      select: { id: true },
      orderBy: { code: 'asc' },
    }))
  )
}

export async function listEvents(ctx: OrgContext) {
  assertPermission(ctx, 'account:read')
  return db.equityEvent.findMany({
    where: { orgId: ctx.orgId },
    include: {
      shareholder: { select: { name: true } },
      bankAccount: { select: { code: true, name: true } },
    },
    orderBy: { date: 'desc' },
    take: 200,
  })
}

export async function listBanks(ctx: OrgContext) {
  assertPermission(ctx, 'journal:post')
  return db.ledgerAccount.findMany({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      subtype: { in: ['BANK', 'UNDEPOSITED_FUNDS'] },
    },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  })
}

export async function postEquityEvent(
  ctx: OrgContext,
  input: {
    kind: EquityEventKind
    amount: string
    date?: CalendarDate
    memo?: string | null
    bankAccountId: string
    shareholderId?: string | null
    equityAccountId?: string | null
  },
) {
  assertPermission(ctx, 'journal:post')
  const amount = new Decimal(input.amount)
  if (amount.lessThanOrEqualTo(0)) throw validation('Amount must be greater than zero.')

  const bank = await db.ledgerAccount.findFirst({
    where: {
      id: input.bankAccountId,
      orgId: ctx.orgId,
      isActive: true,
      subtype: { in: ['BANK', 'UNDEPOSITED_FUNDS'] },
    },
  })
  if (!bank) throw notFound('Bank account')

  const statementSubtype = equityEventStatementSubtype(input.kind)
  let equityAccountId = input.equityAccountId
  if (input.shareholderId) {
    const sh = await db.shareholder.findFirst({
      where: { id: input.shareholderId, orgId: ctx.orgId },
      select: { capitalAccountId: true, name: true },
    })
    if (!sh) throw notFound('Shareholder')
    if (sh.capitalAccountId && input.kind === 'CONTRIBUTION') equityAccountId = sh.capitalAccountId
  }

  const equity =
    equityAccountId ??
    (await accountBySubtype(ctx, statementSubtype))?.id ??
    (await accountBySubtype(ctx, 'OWNERS_EQUITY'))?.id
  if (!equity) throw validation("Owner's equity account is missing from the chart.")

  const date = input.date ?? today(ctx.organization.timeZone)
  const memo =
    input.memo?.trim() ||
    ({
      CONTRIBUTION: 'Owner contribution',
      DRAW: 'Owner draw',
      DIVIDEND: 'Dividend distribution',
      PATRONAGE: 'Patronage allocation',
    }[input.kind] ?? 'Equity event')

  const lines = equityEventCreditsEquity(input.kind)
    ? [
        { accountId: bank.id, debit: amount, description: memo },
        { accountId: equity, credit: amount, description: memo },
      ]
    : [
        { accountId: equity, debit: amount, description: memo },
        { accountId: bank.id, credit: amount, description: memo },
      ]

  return db.$transaction(async (tx) => {
    const journal = await postJournal(tx, ctx, {
      date,
      memo,
      sourceType: 'MANUAL',
      lines,
    })

    const event = await tx.equityEvent.create({
      data: {
        orgId: ctx.orgId,
        kind: input.kind,
        shareholderId: input.shareholderId ?? null,
        amount,
        date: toDate(date),
        memo,
        bankAccountId: bank.id,
        equityAccountId: equity,
        journalId: journal.id,
      },
    })

    return { eventId: event.id, journalId: journal.id, journalNumber: journal.journalNumber }
  })
}

export async function shareholderRegisterRows(ctx: OrgContext) {
  assertPermission(ctx, 'account:read')
  const rows = await db.shareholder.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { name: 'asc' },
    include: { capitalAccount: { select: { code: true, name: true } } },
  })
  return rows.map((row) => ({
    name: row.name,
    shares: row.shares.toString(),
    ownershipPercent: row.ownershipPercent.toString(),
    capitalAccount: row.capitalAccount
      ? `${row.capitalAccount.code} ${row.capitalAccount.name}`
      : '',
  }))
}

export async function shareholderRegisterExport(ctx: OrgContext) {
  return shareholderRegisterCsv(await shareholderRegisterRows(ctx))
}

export async function periodEquityMovementRows(
  ctx: OrgContext,
  range?: { from?: CalendarDate | null; to?: CalendarDate | null },
): Promise<EquityMovementRow[]> {
  assertPermission(ctx, 'account:read')
  const from = range?.from ? toDate(range.from) : undefined
  const to = range?.to ? toDate(range.to) : undefined
  const events = await db.equityEvent.findMany({
    where: {
      orgId: ctx.orgId,
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    include: {
      shareholder: { select: { name: true } },
      equityAccount: { select: { code: true, name: true } },
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  })
  return events.map((row) => ({
    date: toCalendarDate(row.date),
    kind: row.kind,
    shareholder: row.shareholder?.name ?? '',
    amount: row.amount.toFixed(4),
    memo: row.memo ?? '',
    equityAccount: `${row.equityAccount.code} ${row.equityAccount.name}`,
  }))
}

export async function periodEquityMovementExport(
  ctx: OrgContext,
  range?: { from?: CalendarDate | null; to?: CalendarDate | null },
) {
  return equityMovementCsv(await periodEquityMovementRows(ctx, range))
}
