import 'server-only'

import { Decimal, ZERO } from '@/lib/money'
import {
  normalizeOwnershipPercent,
  rollupWithOwnership,
  type ConsolCompanyRow,
} from '@/lib/erp/consolidation-ownership'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { forbidden } from '@/server/errors'

export type CompanyTotals = {
  orgId: string
  name: string
  isParent: boolean
  ownershipPercent: Decimal
  income: Decimal
  expense: Decimal
  net: Decimal
  assets: Decimal
  liabilities: Decimal
  equity: Decimal
  /** Owned share of net (parent 100%, sub at ownership %). */
  ownedNet: Decimal
  /** NCI on this row (0 for parent). */
  nci: Decimal
}

/**
 * Combined P&L and balance-sheet totals for the parent org and its children.
 * Journals whose memo starts with [IC] are skipped (simple elimination).
 * Subsidiary totals are rolled at ownershipPercent; NCI is the equity remainder.
 */
export async function consolidatedGroup(ctx: OrgContext) {
  if (!ctx.permissions.has('report:read')) throw forbidden('Reports required.')

  const parentId = ctx.organization.parentOrgId ?? ctx.orgId
  const companies = await db.organization.findMany({
    where: {
      OR: [{ id: parentId }, { parentOrgId: parentId }],
    },
    select: {
      id: true,
      name: true,
      baseCurrency: true,
      parentOrgId: true,
      ownershipPercent: true,
    },
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
    const net = income.minus(expense)
    const equity = new Decimal(pl?.equity ?? 0)
    const isParent = company.id === parentId
    const ownershipPercent = isParent
      ? new Decimal(100)
      : normalizeOwnershipPercent(company.ownershipPercent.toString())
    const ownedNet = isParent
      ? net
      : net.times(ownershipPercent).div(100).toDecimalPlaces(4)
    const nci = isParent
      ? ZERO
      : equity.times(new Decimal(100).minus(ownershipPercent)).div(100).toDecimalPlaces(4)

    rows.push({
      orgId: company.id,
      name: company.name,
      isParent,
      ownershipPercent,
      income,
      expense,
      net,
      assets: new Decimal(pl?.assets ?? 0),
      liabilities: new Decimal(pl?.liabilities ?? 0),
      equity,
      ownedNet,
      nci,
    })
  }

  rows.sort((a, b) => {
    if (a.isParent) return -1
    if (b.isParent) return 1
    return a.name.localeCompare(b.name)
  })

  const rollupInput: ConsolCompanyRow[] = rows.map((row) => ({
    orgId: row.orgId,
    isParent: row.isParent,
    ownershipPercent: row.ownershipPercent,
    income: row.income,
    expense: row.expense,
    net: row.net,
    assets: row.assets,
    liabilities: row.liabilities,
    equity: row.equity,
  }))
  const rollup = rollupWithOwnership(rollupInput)

  return {
    parentId,
    companies: rows,
    totals: {
      income: rollup.income,
      expense: rollup.expense,
      net: rollup.net,
      assets: rollup.assets,
      liabilities: rollup.liabilities,
      equity: rollup.equity,
      nci: rollup.nci,
    },
  }
}

/** Back-compat name used by the existing page. */
export async function consolidatedProfitAndLoss(ctx: OrgContext) {
  return consolidatedGroup(ctx)
}
