import 'server-only'

import { Decimal, ZERO } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { forbidden } from '@/server/errors'

export type CompanyTotals = {
  orgId: string
  name: string
  income: Decimal
  expense: Decimal
  net: Decimal
  assets: Decimal
  liabilities: Decimal
  equity: Decimal
}

/**
 * Combined P&L and balance-sheet totals for the parent org and its children.
 * Journals whose memo starts with [IC] are skipped (simple elimination).
 */
export async function consolidatedGroup(ctx: OrgContext) {
  if (!ctx.permissions.has('report:read')) throw forbidden('Reports required.')

  const parentId = ctx.organization.parentOrgId ?? ctx.orgId
  const companies = await db.organization.findMany({
    where: {
      OR: [{ id: parentId }, { parentOrgId: parentId }],
    },
    select: { id: true, name: true, baseCurrency: true },
    orderBy: { name: 'asc' },
  })

  const rows: CompanyTotals[] = []

  for (const company of companies) {
    const [pl] = await db.$queryRaw<
      {
        income: string
        expense: string
        assets: string
        liabilities: string
        equity: string
      }[]
    >`
      SELECT
        COALESCE(SUM(CASE WHEN a.type = 'INCOME' THEN l.credit - l.debit ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN a.type IN ('EXPENSE', 'COST_OF_GOODS_SOLD', 'OTHER_EXPENSE')
          THEN l.debit - l.credit ELSE 0 END), 0) AS expense,
        COALESCE(SUM(CASE WHEN a.type = 'ASSET' THEN l.debit - l.credit ELSE 0 END), 0) AS assets,
        COALESCE(SUM(CASE WHEN a.type = 'LIABILITY' THEN l.credit - l.debit ELSE 0 END), 0) AS liabilities,
        COALESCE(SUM(CASE WHEN a.type = 'EQUITY' THEN l.credit - l.debit ELSE 0 END), 0) AS equity
        FROM journal_lines l
        JOIN journals j ON j.id = l."journalId" AND j.status NOT IN ('DRAFT', 'DELETED')
        JOIN ledger_accounts a ON a.id = l."accountId"
       WHERE l."orgId" = ${company.id}
         AND COALESCE(j.memo, '') NOT LIKE '[IC]%'
    `
    const income = new Decimal(pl?.income ?? 0)
    const expense = new Decimal(pl?.expense ?? 0)
    rows.push({
      orgId: company.id,
      name: company.name,
      income,
      expense,
      net: income.minus(expense),
      assets: new Decimal(pl?.assets ?? 0),
      liabilities: new Decimal(pl?.liabilities ?? 0),
      equity: new Decimal(pl?.equity ?? 0),
    })
  }

  const totals = rows.reduce(
    (acc, row) => ({
      income: acc.income.plus(row.income),
      expense: acc.expense.plus(row.expense),
      net: acc.net.plus(row.net),
      assets: acc.assets.plus(row.assets),
      liabilities: acc.liabilities.plus(row.liabilities),
      equity: acc.equity.plus(row.equity),
    }),
    {
      income: ZERO,
      expense: ZERO,
      net: ZERO,
      assets: ZERO,
      liabilities: ZERO,
      equity: ZERO,
    },
  )

  return { parentId, companies: rows, totals }
}

/** Back-compat name used by the existing page. */
export async function consolidatedProfitAndLoss(ctx: OrgContext) {
  return consolidatedGroup(ctx)
}
