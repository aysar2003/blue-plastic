import { Decimal, ZERO } from '@/lib/money'

export const EXTRA_SNAPSHOT_KEYS = ['stockValue', 'openJobs', 'vanStock'] as const
export type ExtraSnapshotKey = (typeof EXTRA_SNAPSHOT_KEYS)[number]

export function isOpenServiceJob(status: string): boolean {
  return status === 'DRAFT' || status === 'SCHEDULED'
}

export function vanStockValue(
  lines: { quantity: Decimal.Value; averageCost: Decimal.Value }[],
): Decimal {
  return lines.reduce(
    (sum, line) => sum.plus(new Decimal(line.quantity).times(line.averageCost)),
    ZERO,
  )
}
