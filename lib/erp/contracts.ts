import { Decimal } from '@/lib/money'

export const SALES_CONTRACT_STATUSES = ['DRAFT', 'ACTIVE', 'DONE', 'CANCELLED'] as const
export type SalesContractStatus = (typeof SALES_CONTRACT_STATUSES)[number]

export function isSalesContractStatus(value: string): value is SalesContractStatus {
  return (SALES_CONTRACT_STATUSES as readonly string[]).includes(value)
}

export function canActivateContract(status: SalesContractStatus): boolean {
  return status === 'DRAFT'
}

export function canBillMilestone(input: {
  contractStatus: SalesContractStatus
  milestoneBilledAt: Date | string | null
  milestonePercent: string
}): { ok: true } | { ok: false; message: string } {
  if (input.contractStatus !== 'ACTIVE') {
    return { ok: false, message: 'Only active contracts can bill milestones.' }
  }
  if (input.milestoneBilledAt) {
    return { ok: false, message: 'This milestone was already billed.' }
  }
  const pct = new Decimal(input.milestonePercent)
  if (pct.lessThanOrEqualTo(0) || pct.greaterThan(100)) {
    return { ok: false, message: 'Milestone percent must be between 0 and 100.' }
  }
  return { ok: true }
}

export function milestoneAmount(contractValue: string, percent: string): string {
  return new Decimal(contractValue).times(new Decimal(percent).dividedBy(100)).toFixed(4)
}

export function milestonePercentsValid(percents: string[]): boolean {
  const total = percents.reduce((sum, p) => sum.plus(new Decimal(p)), new Decimal(0))
  return total.lessThanOrEqualTo(100)
}

/** Contract value including approved change orders. */
export function effectiveContractValue(contractValue: string, changeOrderAmount?: string | null): string {
  return new Decimal(contractValue || '0').plus(new Decimal(changeOrderAmount || '0')).toFixed(4)
}

export function contractBilledRemaining(input: {
  contractValue: string
  changeOrderAmount?: string | null
  billedAmount: string
}): { effective: string; billed: string; remaining: string } {
  const effective = new Decimal(effectiveContractValue(input.contractValue, input.changeOrderAmount))
  const billed = new Decimal(input.billedAmount || '0')
  return {
    effective: effective.toFixed(4),
    billed: billed.toFixed(4),
    remaining: effective.minus(billed).toFixed(4),
  }
}