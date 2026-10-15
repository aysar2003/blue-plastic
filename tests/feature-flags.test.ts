import { describe, expect, it } from 'vitest'

import { LAUNCHER_APPS } from '@/components/layout/launcher-apps'
import {
  DEFAULT_FEATURE_FLAGS,
  featureFlagsWithModules,
  hasAnyModuleEnabled,
  isModuleEnabled,
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
    const flags = parseFeatureFlags({ modules: { sales: false, inventory: false } })
    const hidden = LAUNCHER_APPS.filter((app) => !isModuleEnabled(flags, app.key)).map((app) => app.key)
    expect(hidden.sort()).toEqual(['barcodes', 'customers', 'inventory', 'payments', 'sales', 'stores'])
  })

  it('never hides settings', () => {
    const allOff = parseFeatureFlags({
      modules: { sales: false, purchases: false, banking: false, inventory: false, pos: false, accounting: false, reports: false },
    })
    expect(isModuleEnabled(allOff, 'settings')).toBe(true)
  })

  it('parses signup module selection and requires at least one app', () => {
    expect(parseModulesSelection({ sales: true, pos: false }).sales).toBe(true)
    expect(parseModulesSelection({ sales: true, pos: false }).pos).toBe(false)
    expect(hasAnyModuleEnabled(parseModulesSelection({ sales: false, purchases: false }))).toBe(true)
    const formOff = modulesFromFormValues({
      moduleSales: 'false',
      modulePurchases: 'false',
      moduleBanking: 'false',
      moduleInventory: 'false',
      modulePos: 'false',
      moduleAccounting: 'false',
      moduleReports: 'false',
    })
    expect(hasAnyModuleEnabled(formOff)).toBe(false)
    expect(featureFlagsWithModules({ ...DEFAULT_FEATURE_FLAGS.modules, sales: false }).modules.sales).toBe(
      false,
    )
  })
})
