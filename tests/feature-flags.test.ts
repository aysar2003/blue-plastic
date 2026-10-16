import { describe, expect, it } from 'vitest'

import { LAUNCHER_APPS } from '@/components/layout/launcher-apps'
import {
  DEFAULT_FEATURE_FLAGS,
  featureFlagsWithModules,
  hasAnyModuleEnabled,
  isModuleEnabled,
  isModuleGranted,
  modulesClampedToGrants,
  modulesFromFormValues,
  parseFeatureFlags,
  parseModulesSelection,
} from '@/lib/feature-flags'

describe('feature flags', () => {
  it('falls back to defaults for missing or malformed JSON', () => {
    expect(parseFeatureFlags(null)).toEqual(DEFAULT_FEATURE_FLAGS)
    expect(parseFeatureFlags('nonsense')).toEqual(DEFAULT_FEATURE_FLAGS)
    const parsed = parseFeatureFlags({ allowDocumentDelete: false, showCreatorBrand: 'no' })
    expect(parsed.allowDocumentDelete).toBe(false)
    expect(parsed.showCreatorBrand).toBe(true)
    expect(parsed.enableTax).toBe(true)
  })

  it('reads the company tax switch', () => {
    expect(parseFeatureFlags({ enableTax: false }).enableTax).toBe(false)
  })

  it('defaults customer portal off and can turn it on', () => {
    expect(parseFeatureFlags(null).enableCustomerPortal).toBe(false)
    expect(parseFeatureFlags({ enableCustomerPortal: true }).enableCustomerPortal).toBe(true)
  })

  it('maps the legacy contact delete switch onto customer and vendor', () => {
    const parsed = parseFeatureFlags({ allowContactDelete: false })
    expect(parsed.allowCustomerDelete).toBe(false)
    expect(parsed.allowVendorDelete).toBe(false)
  })

  it('hides every launcher app that belongs to a switched-off module', () => {
    // Older saves only had family flags — child apps inherit until Apps & features is saved again.
    const flags = parseFeatureFlags({ modules: { sales: false, inventory: false } })
    const hidden = LAUNCHER_APPS.filter((app) => !isModuleEnabled(flags, app.key)).map((app) => app.key)
    expect(hidden.sort()).toEqual([
      'barcodes',
      'customers',
      'inventory',
      'payments',
      'projects',
      'sales',
      'stores',
    ])
  })

  it('never hides settings', () => {
    const allOff = parseFeatureFlags({
      modules: Object.fromEntries(
        Object.keys(DEFAULT_FEATURE_FLAGS.modules).map((key) => [key, false]),
      ),
    })
    expect(isModuleEnabled(allOff, 'settings')).toBe(true)
  })

  it('parses signup module selection and requires at least one app', () => {
    expect(parseModulesSelection({ sales: true, pos: false }).sales).toBe(true)
    expect(parseModulesSelection({ sales: true, pos: false }).pos).toBe(false)
    expect(hasAnyModuleEnabled(parseModulesSelection({ sales: false, purchases: false }))).toBe(true)
    const formOff = modulesFromFormValues({})
    expect(hasAnyModuleEnabled(formOff)).toBe(false)
    expect(featureFlagsWithModules({ ...DEFAULT_FEATURE_FLAGS.modules, sales: false }).modules.sales).toBe(
      false,
    )
  })

  it('turns each app on or off independently once saved', () => {
    const flags = parseFeatureFlags({
      modules: { sales: true, customers: false, projects: true, payments: false },
    })
    expect(isModuleEnabled(flags, 'sales')).toBe(true)
    expect(isModuleEnabled(flags, 'customers')).toBe(false)
    expect(isModuleEnabled(flags, 'projects')).toBe(true)
    expect(isModuleEnabled(flags, 'payments')).toBe(false)
  })

  it('treats older saves without grantedModules as fully granted for whatever was on', () => {
    const flags = parseFeatureFlags({ modules: { sales: true, pos: false } })
    expect(flags.grantedModules.sales).toBe(true)
    expect(flags.grantedModules.pos).toBe(false)
    expect(isModuleGranted(flags, 'sales')).toBe(true)
    expect(isModuleGranted(flags, 'pos')).toBe(false)
  })

  it('refuses to enable an app the company was never granted', () => {
    const flags = parseFeatureFlags({
      grantedModules: { ...DEFAULT_FEATURE_FLAGS.grantedModules, sales: false },
      modules: { ...DEFAULT_FEATURE_FLAGS.modules, sales: true },
    })
    expect(isModuleEnabled(flags, 'sales')).toBe(false)
    const clamped = modulesClampedToGrants(
      { ...DEFAULT_FEATURE_FLAGS.modules, sales: true },
      { ...DEFAULT_FEATURE_FLAGS.grantedModules, sales: false },
    )
    expect(clamped.sales).toBe(false)
  })

  it('copies grants when the system owner sets modules at create time', () => {
    const flags = featureFlagsWithModules({
      ...DEFAULT_FEATURE_FLAGS.modules,
      sales: true,
      pos: false,
    })
    expect(flags.grantedModules.sales).toBe(true)
    expect(flags.grantedModules.pos).toBe(false)
    expect(flags.modules.pos).toBe(false)
  })
})
