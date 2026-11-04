import 'server-only'

import { Decimal, ZERO } from '@/lib/money'
import { today, type CalendarDate } from '@/lib/date'
import { postJournal } from '@/server/accounting/posting'
import { systemAccountId } from '@/server/accounting/chart-of-accounts'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { validation } from '@/server/errors'

/**
 * Minimal unrealised FX revaluation for open foreign AR/AP journal lines.
 * Posts Dr/Cr AR (or AP) vs Exchange Gain/Loss for the difference between
 * the original base amount and foreign × newRate.
 */
export async function revalueOpenForeign(
  ctx: OrgContext,
  input: { currencyCode: string; newRate: string; date?: CalendarDate },
) {
  assertPermission(ctx, 'journal:post')
  const currency = input.currencyCode.trim().toUpperCase()
  if (currency.length !== 3) throw validation('Use a 3-letter currency code.')
  if (currency === ctx.organization.baseCurrency) {
    throw validation('Revaluation is only for currencies other than the base.')
  }
  const rate = new Decimal(input.newRate)
  if (rate.lessThanOrEqualTo(0)) throw validation('Exchange rate must be greater than zero.')

  const asOf = input.date ?? today(ctx.organization.timeZone)

  const lines = await db.journalLine.findMany({
    where: {
      orgId: ctx.orgId,
      journal: {
        status: 'POSTED',
        currencyCode: currency,
        deletedAt: null,
      },
      OR: [{ customerId: { not: null } }, { vendorId: { not: null } }],
      AND: [
        { OR: [{ foreignDebit: { not: null } }, { foreignCredit: { not: null } }] },
      ],
    },
    select: {
      id: true,
      accountId: true,
      customerId: true,
      vendorId: true,
      debit: true,
      credit: true,
      foreignDebit: true,
      foreignCredit: true,
      description: true,
    },
  })

  type Adj = {
    accountId: string
    customerId: string | null
    vendorId: string | null
    amount: Decimal
  }
  const adjustments = new Map<string, Adj>()

  for (const line of lines) {
    const foreign = new Decimal((line.foreignDebit ?? line.foreignCredit ?? 0).toString())
    if (foreign.isZero()) continue
    const isDebit = line.foreignDebit != null && !new Decimal(line.foreignDebit.toString()).isZero()
    const currentBase = new Decimal((isDebit ? line.debit : line.credit).toString())
    const targetBase = foreign.times(rate).toDecimalPlaces(4)
    const delta = targetBase.minus(currentBase)
    if (delta.isZero()) continue

    const key = `${line.accountId}|${line.customerId ?? ''}|${line.vendorId ?? ''}|${isDebit ? 'D' : 'C'}`
    const existing = adjustments.get(key)
    // Debit-normal AR: increase base → debit AR. Credit-normal AP: increase base → credit AP.
    const signed = isDebit ? delta : delta.negated()
    if (existing) existing.amount = existing.amount.plus(signed)
    else {
      adjustments.set(key, {
        accountId: line.accountId,
        customerId: line.customerId,
        vendorId: line.vendorId,
        amount: signed,
      })
    }
  }

  const rows = [...adjustments.values()].filter((row) => !row.amount.isZero())
  if (rows.length === 0) {
    return { posted: false, journalId: null as string | null, lines: 0 }
  }

  const fxAccountId = await db.$transaction(async (tx) => {
    return systemAccountId(tx, ctx.orgId, 'EXCHANGE_GAIN_LOSS')
  })

  let controlTotal = ZERO
  const draftLines: {
    accountId: string
    debit?: Decimal
    credit?: Decimal
    customerId?: string | null
    vendorId?: string | null
    description?: string
  }[] = []

  for (const row of rows) {
    if (row.amount.isPositive()) {
      draftLines.push({
        accountId: row.accountId,
        debit: row.amount,
        customerId: row.customerId,
        vendorId: row.vendorId,
        description: `FX revaluation ${currency} @ ${rate.toString()}`,
      })
      controlTotal = controlTotal.plus(row.amount)
    } else {
      const mag = row.amount.abs()
      draftLines.push({
        accountId: row.accountId,
        credit: mag,
        customerId: row.customerId,
        vendorId: row.vendorId,
        description: `FX revaluation ${currency} @ ${rate.toString()}`,
      })
      controlTotal = controlTotal.minus(mag)
    }
  }

  if (controlTotal.isPositive()) {
    draftLines.push({
      accountId: fxAccountId,
      credit: controlTotal,
      description: `Unrealised FX ${currency}`,
    })
  } else if (controlTotal.isNegative()) {
    draftLines.push({
      accountId: fxAccountId,
      debit: controlTotal.abs(),
      description: `Unrealised FX ${currency}`,
    })
  }

  const journal = await db.$transaction(async (tx) => {
    return postJournal(tx, ctx, {
      date: asOf,
      memo: `FX revaluation ${currency} @ ${rate.toString()}`,
      sourceType: 'MANUAL',
      isAdjusting: true,
      currencyCode: ctx.organization.baseCurrency,
      exchangeRate: 1,
      lines: draftLines,
    })
  })

  return { posted: true, journalId: journal.id, lines: draftLines.length, asOf }
}

/** List distinct foreign currencies currently on posted journals. */
export async function listForeignCurrencies(ctx: OrgContext) {
  assertPermission(ctx, 'journal:read')
  const rows = await db.journal.findMany({
    where: {
      orgId: ctx.orgId,
      status: 'POSTED',
      deletedAt: null,
      currencyCode: { not: ctx.organization.baseCurrency },
    },
    select: { currencyCode: true },
    distinct: ['currencyCode'],
    orderBy: { currencyCode: 'asc' },
  })
  return rows.map((row) => row.currencyCode)
}
