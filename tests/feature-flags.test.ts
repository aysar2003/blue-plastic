import { describe, expect, it } from 'vitest'

import { LAUNCHER_APPS } from '@/components/layout/launcher-apps'
import { DEFAULT_FEATURE_FLAGS, isModuleEnabled, parseFeatureFlags } from '@/lib/feature-flags'

describe('feature flags', () => {
  it('falls back to defaults for missing or malformed JSON', () => {
    expect(parseFeatureFlags(null)).toEqual(DEFAULT_FEATURE_FLAGS)
    expect(parseFeatureFlags('nonsense')).toEqual(DEFAULT_FEATURE_FLAGS)
    const parsed = parseFeatureFlags({ allowDocumentDelete: false, showCreatorBrand: 'no' })
    expect(parsed.allowDocumentDelete).toBe(false)
    expect(parsed.showCreatorBrand).toBe(true)
  })

  it('hides every launcher app that belongs to a switched-off module', () => {
    const flags = parseFeatureFlags({ modules: { sales: false, inventory: false } })
    const hidden = LAUNCHER_APPS.filter((app) => !isModuleEnabled(flags, app.key)).map((app) => app.key)
    expect(hidden.sort()).toEqual(['customers', 'inventory', 'payments', 'sales', 'stores'])
  })

  it('never hides settings', () => {
    const allOff = parseFeatureFlags({
      modules: { sales: false, purchases: false, banking: false, inventory: false, pos: false, accounting: false, reports: false },
    })
    expect(isModuleEnabled(allOff, 'settings')).toBe(true)
  })
})
