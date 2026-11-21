import { Decimal, ZERO } from '@/lib/money'

export type SeasonalLotRow = {
  lotId: string
  lotNumber: string
  originLabel: string | null
  itemId: string
  itemName: string
  storeId: string
  storeName: string
  quantity: string
  averageCost: string
  projectId?: string | null
  trackingCategoryId?: string | null
}

export function seasonalLotExtendedCost(quantity: string, averageCost: string): string {
  return new Decimal(quantity || '0').times(averageCost || '0').toFixed(4)
}

export function filterSeasonalRows(
  rows: SeasonalLotRow[],
  input: {
    storeId?: string | null
    originQuery?: string | null
    projectId?: string | null
    trackingCategoryId?: string | null
  },
): SeasonalLotRow[] {
  let out = rows
  if (input.storeId) {
    out = out.filter((row) => row.storeId === input.storeId)
  }
  const q = input.originQuery?.trim().toLowerCase()
  if (q) {
    out = out.filter((row) => (row.originLabel ?? '').toLowerCase().includes(q))
  }
  if (input.projectId) {
    out = out.filter((row) => row.projectId === input.projectId)
  }
  if (input.trackingCategoryId) {
    out = out.filter((row) => row.trackingCategoryId === input.trackingCategoryId)
  }
  return out
}

export function totalSeasonalCost(rows: SeasonalLotRow[]): string {
  return rows
    .reduce(
      (sum, row) => sum.plus(seasonalLotExtendedCost(row.quantity, row.averageCost)),
      ZERO,
    )
    .toFixed(2)
}