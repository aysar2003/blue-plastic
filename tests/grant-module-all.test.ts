import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FEATURE_FLAGS,
  grantModuleOnFlags,
  parseFeatureFlags,
} from '@/lib/feature-flags'
import { grantModuleToAllSchema } from '@/lib/validation/company'

describe('grantModuleOnFlags', () => {
  it('turns granted and modules on when missing', () => {
    const prior = parseFeatureFlags({
      ...DEFAULT_FEATURE_FLAGS,
      grantedModules: { ...DEFAULT_FEATURE_FLAGS.grantedModules, projects: false },
      modules: { ...DEFAULT_FEATURE_FLAGS.modules, projects: false },
    })
    const next = grantModuleOnFlags(prior, 'projects')
    expect(next.changed).toBe(true)
    expect(next.flags.grantedModules.projects).toBe(true)
    expect(next.flags.modules.projects).toBe(true)
  })

  it('is idempotent when already granted and on', () => {
    const prior = parseFeatureFlags({
      ...DEFAULT_FEATURE_FLAGS,
      grantedModules: { ...DEFAULT_FEATURE_FLAGS.grantedModules, approvals: true },
      modules: { ...DEFAULT_FEATURE_FLAGS.modules, approvals: true },
    })
    const next = grantModuleOnFlags(prior, 'approvals')
    expect(next.changed).toBe(false)
    expect(next.flags).toBe(prior)
  })

  it('turns modules on when granted but company left it off', () => {
    const prior = parseFeatureFlags({
      ...DEFAULT_FEATURE_FLAGS,
      grantedModules: { ...DEFAULT_FEATURE_FLAGS.grantedModules, projects: true },
      modules: { ...DEFAULT_FEATURE_FLAGS.modules, projects: false },
    })
    const next = grantModuleOnFlags(prior, 'projects')
    expect(next.changed).toBe(true)
    expect(next.flags.modules.projects).toBe(true)
  })
})

describe('grantModuleToAllSchema', () => {
  it('accepts known modules and rejects unknown', () => {
    expect(grantModuleToAllSchema.parse({ module: 'projects' }).module).toBe('projects')
    expect(() => grantModuleToAllSchema.parse({ module: 'not-real' })).toThrow()
  })
})
