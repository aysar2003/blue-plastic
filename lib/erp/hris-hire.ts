import { Decimal, ZERO } from '@/lib/money'

/** Hire is payroll-eligible once ACTIVE with a wage (card or open contract). */
export function isPayrollEligible(row: {
  lifecycleStatus: string
  active: boolean
  leftAt?: Date | string | null
  wageAmount?: Decimal.Value | null
  hasOpenContract?: boolean
}): boolean {
  if (!row.active) return false
  if (row.lifecycleStatus !== 'ACTIVE') return false
  if (row.leftAt) return false
  const wage = new Decimal(row.wageAmount ?? 0)
  return wage.greaterThan(ZERO) || Boolean(row.hasOpenContract)
}

export function hireContractName(employeeName: string, jobTitle?: string | null): string {
  const title = jobTitle?.trim()
  return title ? `${employeeName} · ${title}` : `${employeeName} · employment`
}
