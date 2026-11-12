import { describe, expect, it } from 'vitest'

import {
  defaultOnboardingAnswers,
  recommendPackFromAnswers,
} from '@/lib/packs/recommend'

describe('recommendPackFromAnswers', () => {
  it('maps hospital sector to hospital_admin', () => {
    const result = recommendPackFromAnswers({
      ...defaultOnboardingAnswers(),
      sector: 'hospital',
      usesPos: false,
    })
    expect(result.packId).toBe('hospital_admin')
    expect(result.label.length).toBeGreaterThan(0)
  })

  it('maps manufacturing sector to manufacturing', () => {
    const result = recommendPackFromAnswers({
      ...defaultOnboardingAnswers(),
      sector: 'manufacturing',
      manufactures: true,
    })
    expect(result.packId).toBe('manufacturing')
  })

  it('upgrades trading + manufactures to manufacturing', () => {
    const result = recommendPackFromAnswers({
      ...defaultOnboardingAnswers(),
      sector: 'trading',
      manufactures: true,
    })
    expect(result.packId).toBe('manufacturing')
  })

  it('maps mixed to full', () => {
    expect(recommendPackFromAnswers({ ...defaultOnboardingAnswers(), sector: 'mixed' }).packId).toBe(
      'full',
    )
  })

  it('offers full as an alternative for focused packs', () => {
    const result = recommendPackFromAnswers({
      ...defaultOnboardingAnswers(),
      sector: 'retail',
    })
    expect(result.alternatives.some((row) => row.packId === 'full')).toBe(true)
  })
})
