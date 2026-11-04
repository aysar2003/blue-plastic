import 'server-only'

import { Decimal } from '@/lib/money'
import { isCalendarDate, toDate, today, type CalendarDate } from '@/lib/date'
import {
  canCancelHedge,
  canSettleHedge,
  hedgeDocumented,
  isFxHedgeKind,
  markToMarket,
  type FxHedgeKind,
} from '@/lib/erp/fx-hedge'
import { postJournal } from '@/server/accounting/posting'
import { systemAccountId } from '@/server/accounting/chart-of-accounts'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'

export async function listHedges(ctx: OrgContext) {
  assertPermission(ctx, 'journal:read')
  return db.fxHedge.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ status: 'asc' }, { maturityDate: 'asc' }],
    take: 80,
  })
}

export async function createHedge(
  ctx: OrgContext,
  input: {
    kind: string
    currencyCode: string
    contractRate: string
    notional: string
    maturityDate: CalendarDate
    risk: string
    hedgedItem: string
    instrument: string
    counterpart?: string | null
    memo?: string | null
  },
) {
  assertPermission(ctx, 'journal:post')
  if (!isFxHedgeKind(input.kind)) throw validation('Kind must be cash-flow or fair-value.')
  if (
    !hedgeDocumented({
      risk: input.risk,
      hedgedItem: input.hedgedItem,
      instrument: input.instrument,
      kind: input.kind,
    })
  ) {
    throw validation('IFRS 9 needs risk, hedged item, instrument, and kind filled in.')
  }
  const currency = input.currencyCode.trim().toUpperCase()
  if (currency.length !== 3) throw validation('Use a 3-letter currency.')
  if (currency === ctx.organization.baseCurrency) {
    throw validation('Hedge a foreign currency, not the base.')
  }
  const rate = new Decimal(input.contractRate)
  const notional = new Decimal(input.notional)
  if (rate.lessThanOrEqualTo(0) || notional.lessThanOrEqualTo(0)) {
    throw validation('Rate and notional must be greater than zero.')
  }
  if (!isCalendarDate(input.maturityDate)) throw validation('Maturity must be a calendar date.')
  return db.fxHedge.create({
    data: {
      orgId: ctx.orgId,
      kind: input.kind as FxHedgeKind,
      currencyCode: currency,
      contractRate: rate.toFixed(9),
      notional: notional.toFixed(4),
      maturityDate: toDate(input.maturityDate),
      risk: input.risk.trim(),
      hedgedItem: input.hedgedItem.trim(),
      instrument: input.instrument.trim(),
      counterpart: input.counterpart?.trim() || null,
      memo: input.memo?.trim() || null,
    },
    select: { id: true },
  })
}

export async function settleHedge(
  ctx: OrgContext,
  input: { id: string; spotRate: string; accountId: string },
) {
  assertPermission(ctx, 'journal:post')
  const row = await db.fxHedge.findFirst({
    where: { id: input.id, orgId: ctx.orgId },
  })
  if (!row) throw notFound('Hedge')
  if (!canSettleHedge(row.status)) throw precondition('Only an open hedge can settle.')
  const account = await db.ledgerAccount.findFirst({
    where: { id: input.accountId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!account) throw notFound('Account')
  const spot = new Decimal(input.spotRate)
  if (spot.lessThanOrEqualTo(0)) throw validation('Spot rate must be greater than zero.')
  const mtm = new Decimal(
    markToMarket(row.notional.toString(), row.contractRate.toString(), spot.toFixed(9)),
  )

  if (mtm.isZero()) {
    return db.fxHedge.update({
      where: { id: row.id },
      data: { status: 'SETTLED' },
      select: { id: true, journalId: true },
    })
  }

  const journal = await db.$transaction(async (tx) => {
    const fxAccountId = await systemAccountId(tx, ctx.orgId, 'EXCHANGE_GAIN_LOSS')
    const mag = mtm.abs()
    const posted = await postJournal(tx, ctx, {
      date: today(ctx.organization.timeZone),
      memo: `Hedge settle ${row.currencyCode} ${row.kind}`,
      sourceType: 'MANUAL',
      isAdjusting: true,
      sourceId: row.id,
      lines: mtm.isPositive()
        ? [
            { accountId: account.id, debit: mag, description: 'Hedge MTM' },
            { accountId: fxAccountId, credit: mag, description: 'Hedge MTM gain' },
          ]
        : [
            { accountId: fxAccountId, debit: mag, description: 'Hedge MTM loss' },
            { accountId: account.id, credit: mag, description: 'Hedge MTM' },
          ],
    })
    await tx.fxHedge.update({
      where: { id: row.id },
      data: { status: 'SETTLED', journalId: posted.id },
    })
    return posted
  })
  return { id: row.id, journalId: journal.id }
}

export async function cancelHedge(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'journal:post')
  const row = await db.fxHedge.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Hedge')
  if (!canCancelHedge(row.status)) throw precondition('Only an open hedge can be cancelled.')
  return db.fxHedge.update({
    where: { id: row.id },
    data: { status: 'CANCELLED' },
    select: { id: true },
  })
}
