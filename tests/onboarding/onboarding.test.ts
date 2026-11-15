import { describe, expect, it } from 'vitest'

import { coverageSummary, getPack, INDUSTRY_PACKS, modulesFromPack } from '@/lib/packs'
import {
  completeOnboardingSchema,
  skipOnboardingSchema,
  toggleChecklistItemSchema,
} from '@/lib/validation/onboarding'

describe('P6 coverage gate', () => {
  it('has zero planned verticals before wizard', () => {
    expect(coverageSummary().verticalPlanned).toBe(0)
    expect(INDUSTRY_PACKS.every((pack) => pack.verticalStatus === 'ready')).toBe(true)
  })
})

describe('P7 onboarding validation', () => {
  it('accepts a known pack and rejects unknown', () => {
    expect(completeOnboardingSchema.parse({ packId: 'retail', seedChart: true }).packId).toBe(
      'retail',
    )
    expect(() => completeOnboardingSchema.parse({ packId: 'not-real' })).toThrow()
  })

  it('accepts skip and checklist toggles', () => {
    expect(skipOnboardingSchema.parse({}).reason).toBeUndefined()
    expect(toggleChecklistItemSchema.parse({ itemId: 'coa', done: true })).toEqual({
      itemId: 'coa',
      done: true,
    })
  })

  it('each ready pack exposes modules and a checklist', () => {
    for (const pack of INDUSTRY_PACKS) {
      expect(pack.enabledModules.length, pack.id).toBeGreaterThan(0)
      expect(Object.values(modulesFromPack(pack)).some(Boolean), pack.id).toBe(true)
      expect(pack.setupChecklist.length, pack.id).toBeGreaterThan(0)
      expect(getPack(pack.id)?.id).toBe(pack.id)
    }
  })

  it('retail checklist covers locale, apps hide, and reorder', () => {
    const retail = getPack('retail')
    expect(retail).toBeTruthy()
    const ids = new Set(retail!.setupChecklist.map((item) => item.id))
    expect(ids.has('locale')).toBe(true)
    expect(ids.has('apps')).toBe(true)
    expect(ids.has('reorder')).toBe(true)
    expect(retail!.enabledModules).toContain('pos')
    expect(retail!.enabledModules).not.toContain('employees')
  })
})
