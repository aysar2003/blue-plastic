import 'server-only'

import { toDate, type CalendarDate } from '@/lib/date'
import { Decimal } from '@/lib/money'
import { pickPaymentDateRate } from '@/lib/erp/fx-payment'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { validation } from '@/server/errors'

/** Rate on or before `asOf` for this currency (org base per 1 foreign unit). */
export async function rateOnDate(
  client: Tx | typeof db,
  orgId: string,
  currencyCode: string,
  asOf: CalendarDate,
): Promise<string | null> {
  const row = await client.fxDailyRate.findFirst({
    where: {
      orgId,
      currencyCode: currencyCode.toUpperCase(),
      rateDate: { lte: toDate(asOf) },
    },
    orderBy: { rateDate: 'desc' },
    select: { rate: true },
  })
  return row ? row.rate.toString() : null
}

export async function upsertRate(
  ctx: OrgContext,
  input: { currencyCode: string; rateDate: CalendarDate; rate: string },
) {
  const currency = input.currencyCode.trim().toUpperCase()
  if (currency.length !== 3) throw validation('Use a 3-letter currency code.')
  const rate = new Decimal(input.rate)
  if (rate.lessThanOrEqualTo(0)) throw validation('Exchange rate must be greater than zero.')
  return db.fxDailyRate.upsert({
    where: {
      orgId_currencyCode_rateDate: {
        orgId: ctx.orgId,
        currencyCode: currency,
        rateDate: toDate(input.rateDate),
      },
    },
    create: {
      orgId: ctx.orgId,
      currencyCode: currency,
      rateDate: toDate(input.rateDate),
      rate: rate.toFixed(9),
    },
    update: { rate: rate.toFixed(9) },
    select: { id: true, currencyCode: true, rateDate: true, rate: true },
  })
}

export async function resolvePaymentDateRate(
  client: Tx | typeof db,
  ctx: OrgContext,
  input: { currencyCode: string; paymentDate: CalendarDate; enteredRate?: Decimal.Value | null },
): Promise<Decimal> {
  const table = await rateOnDate(client, ctx.orgId, input.currencyCode, input.paymentDate)
  return pickPaymentDateRate({
    baseCurrency: ctx.organization.baseCurrency,
    paymentCurrency: input.currencyCode,
    enteredRate: input.enteredRate ?? null,
    tableRate: table,
  })
}
