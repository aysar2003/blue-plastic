import { describe, expect, it } from 'vitest'

import { DEFAULT_FEATURE_FLAGS, parseFeatureFlags } from '@/lib/feature-flags'

describe('close hard gates flag', () => {
  it('defaults off and parses from JSON', () => {
    expect(DEFAULT_FEATURE_FLAGS.closeHardGates).toBe(false)
    expect(parseFeatureFlags({ closeHardGates: true }).closeHardGates).toBe(true)
  })
})
