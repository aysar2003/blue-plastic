import { type ConsolCompanyRow, minorityInterest, ownedShare, rollupWithOwnership } from '@/lib/erp/consolidation-ownership'
import { Decimal, ZERO } from '@/lib/money'

export type PortfolioRow = {
  orgId: string
  name: string
  ownershipPercent: string
  netIncome: string
  nci: string
}

export type PortfolioKpiKey = 'cash' | 'ar' | 'stock' | 'ni'

export type PortfolioKpiInput = {
  cash: Decimal.Value
  ar: Decimal.Value
  stock: Decimal.Value
  ni: Decimal.Value
}

export type PortfolioKpiStripRow = {
  key: PortfolioKpiKey
  label: string
  current: string
  priorYear: string | null
  change: string | null
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

export function ownedPortfolioKpis(
  rows: {
    isParent: boolean
    ownershipPercent: Decimal.Value
    cash: Decimal.Value
    ar: Decimal.Value
    stock: Decimal.Value
    ni: Decimal.Value
  }[],
): PortfolioKpiInput {
  let cash = ZERO
  let ar = ZERO
  let stock = ZERO
  let ni = ZERO
  for (const row of rows) {
    const pct = row.isParent ? new Decimal(100) : row.ownershipPercent
    cash = cash.plus(ownedShare(row.cash, pct))
    ar = ar.plus(ownedShare(row.ar, pct))
    stock = stock.plus(ownedShare(row.stock, pct))
    ni = ni.plus(ownedShare(row.ni, pct))
  }
  return {
    cash: cash.toDecimalPlaces(4),
    ar: ar.toDecimalPlaces(4),
    stock: stock.toDecimalPlaces(4),
    ni: ni.toDecimalPlaces(4),
  }
}

const KPI_LABELS: Record<PortfolioKpiKey, string> = {
  cash: 'Cash',
  ar: 'Accounts receivable',
  stock: 'Stock',
  ni: 'Net income',
}

export function portfolioKpiStrip(
  current: PortfolioKpiInput,
  priorYear: PortfolioKpiInput | null,
): PortfolioKpiStripRow[] {
  const keys: PortfolioKpiKey[] = ['cash', 'ar', 'stock', 'ni']
  return keys.map((key) => {
    const now = new Decimal(current[key])
    const prior = priorYear ? new Decimal(priorYear[key]) : null
    return {
      key,
      label: KPI_LABELS[key],
      current: now.toFixed(4),
      priorYear: prior ? prior.toFixed(4) : null,
      change: prior ? now.minus(prior).toFixed(4) : null,
    }
  })
}