import 'server-only'

import { Decimal, ZERO } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export type FxOpenBalanceRow = {
  currencyCode: string
  side: 'AR' | 'AP'
  foreignBalance: Decimal
  baseBalance: Decimal
  lineCount: number
}

/** Open foreign-currency AR/AP from posted journal lines (subsidiary view). */
export async function fxOpenArAp(ctx: OrgContext): Promise<FxOpenBalanceRow[]> {
  const base = ctx.organization.baseCurrency
  const rows = await db.journalLine.findMany({
    where: {
      orgId: ctx.orgId,
      journal: {
        status: 'POSTED',
        deletedAt: null,
        currencyCode: { not: base },
      },
      OR: [{ customerId: { not: null } }, { vendorId: { not: null } }],
      AND: [{ OR: [{ foreignDebit: { not: null } }, { foreignCredit: { not: null } }] }],
    },
    select: {
      customerId: true,
      vendorId: true,
      debit: true,
      credit: true,
      foreignDebit: true,
      foreignCredit: true,
      journal: { select: { currencyCode: true } },
    },
  })

  const map = new Map<string, FxOpenBalanceRow>()

  for (const line of rows) {
    const currency = line.journal.currencyCode
    const side: 'AR' | 'AP' = line.customerId ? 'AR' : 'AP'
    const key = `${currency}|${side}`
    const foreign = new Decimal((line.foreignDebit ?? line.foreignCredit ?? 0).toString())
    const baseAmt = new Decimal(line.debit.toString()).minus(line.credit.toString())
    const existing = map.get(key) ?? {
      currencyCode: currency,
      side,
      foreignBalance: ZERO,
      baseBalance: ZERO,
      lineCount: 0,
    }
    existing.foreignBalance = existing.foreignBalance.plus(foreign)
    existing.baseBalance = existing.baseBalance.plus(baseAmt)
    existing.lineCount += 1
    map.set(key, existing)
  }

  return [...map.values()]
    .filter((row) => !row.foreignBalance.isZero() || !row.baseBalance.isZero())
    .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode) || a.side.localeCompare(b.side))
}

export function fxOpenNeedsRevaluation(rows: FxOpenBalanceRow[]): boolean {
  return rows.some((row) => !row.foreignBalance.isZero())
}
