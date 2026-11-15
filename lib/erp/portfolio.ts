import { type ConsolCompanyRow, minorityInterest, ownedShare, rollupWithOwnership } from '@/lib/erp/consolidation-ownership'
import { Decimal } from '@/lib/money'

export type PortfolioRow = {
  orgId: string
  name: string
  ownershipPercent: string
  netIncome: string
  nci: string
}

export function portfolioRowsFromConsol(rows: ConsolCompanyRow[], names: Map<string, string>): PortfolioRow[] {
  return rows
    .filter((row) => !row.isParent)
    .map((row) => ({
      orgId: row.orgId,
      name: names.get(row.orgId) ?? row.orgId,
      ownershipPercent: row.ownershipPercent.toFixed(4),
      netIncome: ownedShare(row.net, row.ownershipPercent).toFixed(4),
      nci: minorityInterest(row.equity, row.ownershipPercent).toFixed(4),
    }))
}

export function portfolioCsv(rows: PortfolioRow[]): string {
  const header = 'orgId,name,ownershipPercent,rolledNetIncome,nci'
  const body = rows.map(
    (r) =>
      `${r.orgId},${csvEscape(r.name)},${r.ownershipPercent},${r.netIncome},${r.nci}`,
  )
  return [header, ...body].join('\n')
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function portfolioRollup(rows: ConsolCompanyRow[]) {
  return rollupWithOwnership(rows)
}