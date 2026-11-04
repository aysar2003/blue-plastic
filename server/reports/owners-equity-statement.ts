import 'server-only'

import { Decimal, ZERO } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export async function ownersEquityStatement(ctx: OrgContext) {
  const currency = ctx.organization.baseCurrency

  const events = await db.equityEvent.groupBy({
    by: ['kind'],
    where: { orgId: ctx.orgId },
    _sum: { amount: true },
  })

  let contributions = ZERO
  let draws = ZERO
  let dividends = ZERO
  for (const row of events) {
    const amount = new Decimal(row._sum.amount?.toString() ?? 0)
    if (row.kind === 'CONTRIBUTION') contributions = amount
    if (row.kind === 'DRAW') draws = amount
    if (row.kind === 'DIVIDEND') dividends = amount
  }

  const capitalAccounts = await db.ledgerAccount.findMany({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      OR: [{ subtype: 'OWNERS_EQUITY' }, { type: 'EQUITY' }],
    },
    select: { id: true, subtype: true, systemKey: true },
  })

  const capitalIds = capitalAccounts
    .filter((a) => a.subtype === 'OWNERS_EQUITY')
    .map((a) => a.id)
  const retainedIds = capitalAccounts
    .filter((a) => a.subtype === 'RETAINED_EARNINGS' || a.systemKey === 'RETAINED_EARNINGS')
    .map((a) => a.id)

  async function balanceOf(accountIds: string[]) {
    if (accountIds.length === 0) return ZERO
    const [row] = await db.$queryRaw<{ balance: string }[]>`
      SELECT COALESCE(SUM(l.credit - l.debit), 0) AS balance
        FROM journal_lines l
        JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
       WHERE l."orgId" = ${ctx.orgId}
         AND l."accountId" = ANY(${accountIds})
    `
    return new Decimal(row?.balance ?? 0)
  }

  const capitalBalance = await balanceOf(
    capitalIds.length > 0 ? capitalIds : capitalAccounts.map((a) => a.id),
  )
  const retainedEarningsBalance = await balanceOf(retainedIds)
  const netChange = contributions.minus(draws).minus(dividends)

  return {
    currency,
    contributions,
    draws,
    dividends,
    capitalBalance,
    retainedEarningsBalance,
    netChange,
  }
}

export function totalEquity(statement: Awaited<ReturnType<typeof ownersEquityStatement>>): Decimal {
  return statement.capitalBalance.plus(statement.retainedEarningsBalance)
}
