import 'server-only'

import type { EquityEventKind } from '@prisma/client'

import { today, toDate, type CalendarDate } from '@/lib/date'
import { Decimal, money } from '@/lib/money'
import { postJournal } from '@/server/accounting/posting'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'

async function ownersEquityAccount(ctx: OrgContext) {
  const capital = await db.ledgerAccount.findFirst({
    where: { orgId: ctx.orgId, isActive: true, subtype: 'OWNERS_EQUITY', code: '3000' },
    select: { id: true },
  })
  return (
    capital ??
    (await db.ledgerAccount.findFirst({
      where: { orgId: ctx.orgId, isActive: true, subtype: 'OWNERS_EQUITY' },
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

  let equityAccountId = input.equityAccountId
  if (input.shareholderId) {
    const sh = await db.shareholder.findFirst({
      where: { id: input.shareholderId, orgId: ctx.orgId },
      select: { capitalAccountId: true, name: true },
    })
    if (!sh) throw notFound('Shareholder')
    if (sh.capitalAccountId) equityAccountId = sh.capitalAccountId
  }

  const equity =
    equityAccountId ??
    (await ownersEquityAccount(ctx))?.id
  if (!equity) throw validation("Owner's equity account is missing from the chart.")

  const date = input.date ?? today(ctx.organization.timeZone)
  const memo =
    input.memo?.trim() ||
    ({
      CONTRIBUTION: 'Owner contribution',
      DRAW: 'Owner draw',
      DIVIDEND: 'Dividend distribution',
    }[input.kind] ?? 'Equity event')

  const lines =
    input.kind === 'CONTRIBUTION'
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
