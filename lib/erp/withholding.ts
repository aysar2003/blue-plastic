/**
 * Statutory withholding tax (WHT) on vendor bills — Wave G.
 * Horn practice: one rate on the bill base (often exclusive of VAT).
 */
import { WHT_REMITTANCE_HEADERS } from '@/lib/erp/export-headers'
import { money, type Money } from '@/lib/money'

export type WhtPackRate = {
  /** Display name, e.g. "WHT 2%". */
  name: string
  /** Percent (2 = 2%). */
  percent: number
}

/** Default WHT rates by localization pack (seed / UI hint). */
export const PACK_WHT_RATES: Record<string, WhtPackRate> = {
  ke: { name: 'WHT 5%', percent: 5 },
  et: { name: 'WHT 2%', percent: 2 },
  so: { name: 'WHT 0%', percent: 0 },
  dj: { name: 'WHT 0%', percent: 0 },
}

export function whtRateForPack(packId: string | null | undefined): WhtPackRate | null {
  if (!packId) return null
  return PACK_WHT_RATES[packId] ?? null
}

/** withhold = round(base × percent / 100) to 4 dp money. */
export function computeWithholdAmount(base: Money | string, percent: Money | string | number): Money {
  const p = typeof percent === 'number' ? money(percent) : money(percent)
  if (p.lte(0)) return money(0)
  const b = money(base)
  if (b.lte(0)) return money(0)
  return b.times(p).div(100).toDecimalPlaces(4)
}

/**
 * Net amount still owed to the vendor after WHT:
 * payable = bill total − withhold (WHT is a liability to the tax authority).
 */
export function netPayableAfterWithhold(
  billTotal: Money | string,
  withholdAmount: Money | string,
): Money {
  const total = money(billTotal)
  const held = money(withholdAmount)
  const net = total.minus(held)
  return net.lt(0) ? money(0) : net
}

export type WhtRemittanceRow = {
  billNumber: string
  billDate: string
  vendorName: string
  baseAmount: string
  withholdPercent: string
  withholdAmount: string
  currencyCode: string
}

export function whtRemittanceCsv(rows: WhtRemittanceRow[]): string {
  const lines = [[...WHT_REMITTANCE_HEADERS].join(',')]
  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.billNumber),
        csvEscape(row.billDate),
        csvEscape(row.vendorName),
        csvEscape(row.baseAmount),
        csvEscape(row.withholdPercent),
        csvEscape(row.withholdAmount),
        csvEscape(row.currencyCode),
      ].join(','),
    )
  }
  return lines.join('\r\n')
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}
