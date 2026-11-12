/**
 * Map onboarding interview answers → best industry pack.
 * Pure / no I/O — safe for client and server.
 */
import { getPack } from './registry'
import type { PackId } from './types'

export type OnboardingAnswers = {
  /** Broad sector the company operates in. */
  sector:
    | 'trading'
    | 'retail'
    | 'wholesale'
    | 'manufacturing'
    | 'restaurant'
    | 'hotel'
    | 'pharmacy'
    | 'hospital'
    | 'school'
    | 'university'
    | 'ngo'
    | 'professional'
    | 'construction'
    | 'distribution'
    | 'services'
    | 'mixed'
  sellsProducts: boolean
  sellsServices: boolean
  usesPos: boolean
  multiStore: boolean
  tracksLots: boolean
  manufactures: boolean
  needsPayroll: boolean
  needsTax: boolean
  needsApprovals: boolean
}

export type PackRecommendation = {
  packId: PackId
  label: string
  reason: string
  verticalStatus: 'ready' | 'planned'
  alternatives: { packId: PackId; label: string; reason: string }[]
}

const SECTOR_TO_PACK: Record<OnboardingAnswers['sector'], PackId> = {
  trading: 'trading',
  retail: 'retail',
  wholesale: 'wholesale',
  manufacturing: 'manufacturing',
  restaurant: 'restaurant',
  hotel: 'hotel',
  pharmacy: 'pharmacy',
  hospital: 'hospital_admin',
  school: 'school',
  university: 'university',
  ngo: 'ngo',
  professional: 'professional_services',
  construction: 'construction',
  distribution: 'distribution',
  services: 'services',
  mixed: 'full',
}

function reasonFor(answers: OnboardingAnswers, packId: PackId): string {
  const bits: string[] = []
  bits.push(`Fits your sector choice.`)
  if (answers.usesPos && (packId === 'retail' || packId === 'restaurant' || packId === 'trading')) {
    bits.push('Point of Sale is included.')
  }
  if (answers.manufactures && packId === 'manufacturing') {
    bits.push('Work orders and materials planning suit production.')
  }
  if (answers.tracksLots && (packId === 'pharmacy' || packId === 'manufacturing' || packId === 'distribution')) {
    bits.push('Lot / serial style inventory is a natural fit.')
  }
  if (answers.multiStore) {
    bits.push('Multi-store and transfers stay available.')
  }
  return bits.join(' ')
}

/**
 * Recommend a pack from interview answers. Always returns a concrete PackId.
 */
export function recommendPackFromAnswers(answers: OnboardingAnswers): PackRecommendation {
  let packId = SECTOR_TO_PACK[answers.sector]

  // Soft overrides when answers contradict a thin sector pick.
  if (answers.sector === 'services' && answers.sellsProducts && answers.usesPos) {
    packId = 'retail'
  }
  if (answers.sector === 'trading' && answers.manufactures) {
    packId = 'manufacturing'
  }
  if (answers.sector === 'mixed') {
    packId = 'full'
  }
  if (answers.sector === 'retail' && !answers.usesPos && answers.sellsServices && !answers.sellsProducts) {
    packId = 'professional_services'
  }

  const pack = getPack(packId) ?? getPack('full')!
  const resolvedId = pack.id

  const alternatives: PackRecommendation['alternatives'] = []
  if (resolvedId !== 'full') {
    alternatives.push({
      packId: 'full',
      label: 'Full ERP',
      reason: 'Turn almost everything on; refine later in Apps & features.',
    })
  }
  if (answers.sellsProducts && resolvedId !== 'trading' && resolvedId !== 'retail') {
    const trade = getPack('trading')
    if (trade && trade.id !== resolvedId) {
      alternatives.push({
        packId: trade.id,
        label: trade.label,
        reason: 'General goods trading with stock and invoices.',
      })
    }
  }

  return {
    packId: resolvedId,
    label: pack.label,
    reason: reasonFor(answers, resolvedId),
    verticalStatus: pack.verticalStatus,
    alternatives: alternatives.slice(0, 3),
  }
}

/** Defaults for a blank interview (safe trading company). */
export function defaultOnboardingAnswers(): OnboardingAnswers {
  return {
    sector: 'trading',
    sellsProducts: true,
    sellsServices: false,
    usesPos: true,
    multiStore: true,
    tracksLots: false,
    manufactures: false,
    needsPayroll: true,
    needsTax: true,
    needsApprovals: false,
  }
}
