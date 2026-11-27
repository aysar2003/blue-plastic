/**
 * Pack-aware PAYE / income-tax slabs for Horn localization (Wave G).
 * Progressive marginal brackets — same math as `amountFromSlabs` in payroll-standard.
 * Clerk can still edit SalaryRule after seed; these are defaults only.
 */
import type { SalarySlab } from '@/lib/payroll-standard'
import { amountFromSlabs } from '@/lib/payroll-standard'
import { money, type Money } from '@/lib/money'

export type PayePackRule = {
  code: 'TAX'
  label: string
  calc: 'SLABS'
  /** Monthly progressive brackets (percent). */
  slabs: SalarySlab[]
  /** Optional employer/employee pension percents (ET). */
  employeePensionPercent?: number
  employerPensionPercent?: number
}

/** Somalia Income Tax Law No. 37 (2025) — monthly payroll bands. */
export const SO_PAYE: PayePackRule = {
  code: 'TAX',
  label: 'Payroll income tax (SO)',
  calc: 'SLABS',
  slabs: [
    { upTo: '100', rate: '0' },
    { upTo: '500', rate: '6' },
    { upTo: '1500', rate: '12' },
    { upTo: null, rate: '18' },
  ],
}

/**
 * Kenya PAYE — simplified monthly progressive defaults (Finance Act style bands).
 * Not a substitute for iTax; export CSV for filing.
 */
export const KE_PAYE: PayePackRule = {
  code: 'TAX',
  label: 'PAYE (KE)',
  calc: 'SLABS',
  slabs: [
    { upTo: '24000', rate: '10' },
    { upTo: '32333', rate: '25' },
    { upTo: '500000', rate: '30' },
    { upTo: '800000', rate: '32.5' },
    { upTo: null, rate: '35' },
  ],
}

/** Ethiopia employment income tax (monthly) + pension rates. */
export const ET_PAYE: PayePackRule = {
  code: 'TAX',
  label: 'Employment income tax (ET)',
  calc: 'SLABS',
  slabs: [
    { upTo: '600', rate: '0' },
    { upTo: '1650', rate: '10' },
    { upTo: '3200', rate: '15' },
    { upTo: '5250', rate: '20' },
    { upTo: '7800', rate: '25' },
    { upTo: '10900', rate: '30' },
    { upTo: null, rate: '35' },
  ],
  employeePensionPercent: 7,
  employerPensionPercent: 11,
}

/** Djibouti — flat-ish progressive placeholder (clerk adjusts). */
export const DJ_PAYE: PayePackRule = {
  code: 'TAX',
  label: 'Impôt sur salaires (DJ)',
  calc: 'SLABS',
  slabs: [
    { upTo: '50000', rate: '0' },
    { upTo: '150000', rate: '2' },
    { upTo: '300000', rate: '5' },
    { upTo: null, rate: '10' },
  ],
}

const BY_PACK: Record<string, PayePackRule> = {
  so: SO_PAYE,
  ke: KE_PAYE,
  et: ET_PAYE,
  dj: DJ_PAYE,
}

export function payePackById(packId: string | null | undefined): PayePackRule | null {
  if (!packId) return null
  return BY_PACK[packId] ?? null
}

export function computePayeForPack(
  packId: string | null | undefined,
  taxableGross: Money | string,
): Money {
  const pack = payePackById(packId)
  if (!pack) return money(0)
  return amountFromSlabs(money(taxableGross), pack.slabs)
}

export function employeePensionAmount(
  packId: string | null | undefined,
  taxableGross: Money | string,
): Money {
  const pack = payePackById(packId)
  if (!pack?.employeePensionPercent) return money(0)
  return money(taxableGross).times(pack.employeePensionPercent).div(100)
}

export function employerPensionAmount(
  packId: string | null | undefined,
  taxableGross: Money | string,
): Money {
  const pack = payePackById(packId)
  if (!pack?.employerPensionPercent) return money(0)
  return money(taxableGross).times(pack.employerPensionPercent).div(100)
}
