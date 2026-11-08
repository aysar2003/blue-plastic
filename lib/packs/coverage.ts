import { INDUSTRY_PACKS, packsPlannedVertical, packsReadyForVertical } from './registry'
import type { IndustryPack, PackVerticalStatus } from './types'

export type CoverageRow = {
  id: string
  label: string
  category: string
  verticalStatus: PackVerticalStatus
  inScope: readonly string[]
  outOfScope: readonly string[]
  blurb: string
}

/** Customer-facing coverage table — static, cheap for high traffic. */
export function institutionCoverage(): CoverageRow[] {
  return INDUSTRY_PACKS.map((pack) => ({
    id: pack.id,
    label: pack.label,
    category: pack.category,
    verticalStatus: pack.verticalStatus,
    inScope: pack.inScope,
    outOfScope: pack.outOfScope,
    blurb: pack.blurb,
  }))
}

export function coverageSummary(): {
  total: number
  verticalReady: number
  verticalPlanned: number
  modulePresetsReady: number
} {
  return {
    total: INDUSTRY_PACKS.length,
    verticalReady: packsReadyForVertical().length,
    verticalPlanned: packsPlannedVertical().length,
    /** Every pack ships an installable module preset in Phase 34. */
    modulePresetsReady: INDUSTRY_PACKS.length,
  }
}

export function accountingCoverageBullets(): readonly string[] {
  return [
    'Double-entry general ledger (debits equal credits)',
    'Accounts receivable and accounts payable',
    'Banking, deposits, and reconciliation',
    'Inventory valuation and cost of goods sold',
    'Sales tax / VAT (optional per company)',
    'Multi-currency / FX revaluation (lite)',
    'Fixed assets, equity events, period close',
    'Payroll (standard or simple) and statutory export hooks',
    'Financial and operations reports (P&L, BS, TB, aging, VAT return)',
  ] as const
}

export function packStatusLabel(pack: IndustryPack): string {
  return pack.verticalStatus === 'ready'
    ? 'Vertical ready'
    : 'Module preset ready — vertical deepen planned'
}
