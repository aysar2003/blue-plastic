import { Decimal, ZERO } from '@/lib/money'

export type SellerSaleRow = {
  vendorId: string
  lineAmount: string
  commissionPercent: string
}

export type SettlementTotals = {
  grossSales: string
  commission: string
  sellerPayable: string
}

export type SellerStatementRow = {
  vendorId: string
  grossSales: string
  commission: string
  sellerPayable: string
}

/** Per-seller statement from sale lines (same math as period totals). */
export function sellerStatements(rows: SellerSaleRow[]): SellerStatementRow[] {
  const byVendor = new Map<string, SellerSaleRow[]>()
  for (const row of rows) {
    const list = byVendor.get(row.vendorId) ?? []
    list.push(row)
    byVendor.set(row.vendorId, list)
  }
  return [...byVendor.entries()].map(([vendorId, lines]) => {
    const totals = settlementTotals(lines)
    return { vendorId, ...totals }
  })
}

export function settlementTotals(rows: SellerSaleRow[]): SettlementTotals {
  let gross = ZERO
  let commission = ZERO
  for (const row of rows) {
    const amt = new Decimal(row.lineAmount)
    const pct = new Decimal(row.commissionPercent)
    gross = gross.plus(amt)
    commission = commission.plus(amt.times(pct).div(100))
  }
  commission = commission.toDecimalPlaces(4)
  gross = gross.toDecimalPlaces(4)
  return {
    grossSales: gross.toFixed(4),
    commission: commission.toFixed(4),
    sellerPayable: gross.minus(commission).toFixed(4),
  }
}