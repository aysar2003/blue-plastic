import 'server-only'

import { Decimal } from '@/lib/money'
import { today, type CalendarDate } from '@/lib/date'
import { postJournal } from '@/server/accounting/posting'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'

/**
 * Equity lite: owner puts money in — Dr Bank, Cr Owner's Capital (OWNERS_EQUITY subtype).
 */
export async function postContribution(
  ctx: OrgContext,
  input: {
    bankAccountId: string
    amount: string
    date?: CalendarDate
    memo?: string | null
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
    select: { id: true, name: true },
  })
  if (!bank) throw notFound('Bank account')

  const capital = await db.ledgerAccount.findFirst({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      subtype: 'OWNERS_EQUITY',
      code: '3000',
    },
    select: { id: true },
  })
  const capitalFallback =
    capital ??
    (await db.ledgerAccount.findFirst({
      where: { orgId: ctx.orgId, isActive: true, subtype: 'OWNERS_EQUITY' },
      select: { id: true },
      orderBy: { code: 'asc' },
    }))
  if (!capitalFallback) {
    throw validation("Owner's Capital is missing from the chart of accounts.")
  }

  const date = input.date ?? today(ctx.organization.timeZone)
  const journal = await db.$transaction(async (tx) => {
    return postJournal(tx, ctx, {
      date,
      memo: input.memo?.trim() || `Owner contribution to ${bank.name}`,
      sourceType: 'MANUAL',
      lines: [
        {
          accountId: bank.id,
          debit: amount,
          description: 'Owner contribution',
        },
        {
          accountId: capitalFallback.id,
          credit: amount,
          description: 'Owner contribution',
        },
      ],
    })
  })

  return { journalId: journal.id, journalNumber: journal.journalNumber }
}

export async function listBankAccounts(ctx: OrgContext) {
  assertPermission(ctx, 'journal:post')
  return db.ledgerAccount.findMany({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      subtype: { in: ['BANK', 'UNDEPOSITED_FUNDS'] },
    },
    select: { id: true, code: true, name: true, currencyCode: true },
    orderBy: { code: 'asc' },
  })
}
