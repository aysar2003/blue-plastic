import 'server-only'

import { portfolioCsv, portfolioRollup, portfolioRowsFromConsol } from '@/lib/erp/portfolio'
import { type ConsolCompanyRow } from '@/lib/erp/consolidation-ownership'
import type { OrgContext } from '@/server/auth/context'
import { consolidatedGroup } from '@/server/reports/consolidation'

export async function portfolioReport(ctx: OrgContext) {
  const consol = await consolidatedGroup(ctx)
  const names = new Map(consol.companies.map((row) => [row.orgId, row.name]))
  const rollupInput: ConsolCompanyRow[] = consol.companies.map((row) => ({
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
  const rollup = portfolioRollup(rollupInput)
  const subsidiaries = portfolioRowsFromConsol(rollupInput, names)
  return {
    parentId: consol.parentId,
    subsidiaries,
    rollup: {
      net: rollup.net.toFixed(4),
      nci: rollup.nci.toFixed(4),
    },
    csv: portfolioCsv(subsidiaries),
  }
}