import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FEATURE_FLAGS,
  MODULE_FLAGS,
  hasAnyModuleEnabled,
  isModuleEnabled,
  parseFeatureFlags,
} from '@/lib/feature-flags'
import {
  INDUSTRY_PACKS,
  PACK_IDS,
  accountingCoverageBullets,
  coverageSummary,
  getPack,
  institutionCoverage,
  modulesFromPack,
  packHasAnyModule,
  resolveFeatureFlagsFromPack,
} from '@/lib/packs'

describe('industry pack registry', () => {
  it('registers every pack id exactly once', () => {
    const ids = INDUSTRY_PACKS.map((pack) => pack.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(PACK_IDS).toEqual(ids)
  })

  it('every pack enables at least one module and only known flags', () => {
    const known = new Set<string>(MODULE_FLAGS)
    for (const pack of INDUSTRY_PACKS) {
      expect(packHasAnyModule(pack), pack.id).toBe(true)
      expect(hasAnyModuleEnabled(modulesFromPack(pack)), pack.id).toBe(true)
      for (const flag of pack.enabledModules) {
        expect(known.has(flag), `${pack.id}:${flag}`).toBe(true)
      }
      expect(pack.inScope.length, pack.id).toBeGreaterThan(0)
      expect(pack.setupChecklist.length, pack.id).toBeGreaterThan(0)
      expect(pack.label.trim(), pack.id).not.toBe('')
    }
  })

  it('getPack resolves known ids and rejects unknown', () => {
    expect(getPack('retail')?.label).toMatch(/Retail/i)
    expect(getPack('hospital_admin')?.verticalStatus).toBe('ready')
    expect(getPack('not-a-pack')).toBeNull()
  })

  it('coverage table matches registry size', () => {
    const summary = coverageSummary()
    expect(institutionCoverage()).toHaveLength(summary.total)
    expect(summary.modulePresetsReady).toBe(INDUSTRY_PACKS.length)
    expect(summary.verticalReady + summary.verticalPlanned).toBe(INDUSTRY_PACKS.length)
    expect(accountingCoverageBullets().length).toBeGreaterThan(5)
  })

  it('P6 coverage gate: every industry pack is vertical-ready', () => {
    const summary = coverageSummary()
    expect(summary.verticalPlanned).toBe(0)
    expect(summary.verticalReady).toBe(INDUSTRY_PACKS.length)
    for (const pack of INDUSTRY_PACKS) {
      expect(pack.verticalStatus, pack.id).toBe('ready')
    }
  })
})

describe('resolveFeatureFlagsFromPack', () => {
  it('turns on only pack modules when replacing grants', () => {
    const pack = getPack('retail')!
    const flags = resolveFeatureFlagsFromPack(pack, null, { replaceGrants: true })
    expect(flags.modules.pos).toBe(true)
    expect(flags.modules.sales).toBe(true)
    expect(flags.modules.inventory).toBe(true)
    expect(flags.modules.surveys).toBe(false)
    expect(flags.modules.discuss).toBe(false)
    expect(flags.grantedModules.pos).toBe(true)
    expect(flags.grantedModules.surveys).toBe(false)
    expect(isModuleEnabled(flags, 'pos')).toBe(true)
    expect(isModuleEnabled(flags, 'surveys')).toBe(false)
  })

  it('slims retail sales document kinds', () => {
    const pack = getPack('retail')!
    const flags = resolveFeatureFlagsFromPack(pack, null, { replaceGrants: true })
    expect(flags.documentKinds.sales.SALES_RECEIPT).toBe(true)
    expect(flags.documentKinds.sales.ESTIMATE).toBe(false)
    expect(flags.documentKinds.sales.SALES_ORDER).toBe(false)
  })

  it('clamps to existing grants when replaceGrants is false', () => {
    const pack = getPack('retail')!
    const prior = parseFeatureFlags({
      grantedModules: {
        ...DEFAULT_FEATURE_FLAGS.grantedModules,
        pos: false,
        sales: true,
        inventory: true,
        accounting: true,
        banking: true,
        reports: true,
        customers: true,
        payments: true,
        journals: true,
        periods: true,
        stores: true,
        barcodes: true,
        calendar: true,
      },
      modules: { ...DEFAULT_FEATURE_FLAGS.modules, pos: false },
    })
    const flags = resolveFeatureFlagsFromPack(pack, prior, { replaceGrants: false })
    expect(flags.modules.pos).toBe(false)
    expect(flags.grantedModules.pos).toBe(false)
    expect(flags.modules.sales).toBe(true)
  })

  it('is idempotent for the same pack', () => {
    const pack = getPack('services')!
    const first = resolveFeatureFlagsFromPack(pack, null, { replaceGrants: true })
    const second = resolveFeatureFlagsFromPack(pack, first, { replaceGrants: true })
    expect(second.modules).toEqual(first.modules)
    expect(second.documentKinds).toEqual(first.documentKinds)
  })

  it('full pack enables opt-in collab apps', () => {
    const pack = getPack('full')!
    const flags = resolveFeatureFlagsFromPack(pack, null, { replaceGrants: true })
    expect(flags.modules.employees).toBe(true)
    expect(flags.modules.surveys).toBe(true)
    expect(flags.modules.databases).toBe(false)
  })
})
