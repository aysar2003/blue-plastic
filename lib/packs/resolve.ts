import {
  DEFAULT_FEATURE_FLAGS,
  MODULE_FLAGS,
  defaultDocumentKinds,
  featureFlagsWithModules,
  modulesClampedToGrants,
  parseDocumentKinds,
  type ModuleFlag,
  type OrgFeatureFlags,
} from '@/lib/feature-flags'

import type { IndustryPack, PackInstallOptions } from './types'

/** Build a full modules map: pack-enabled apps on, everything else off. */
export function modulesFromPack(pack: IndustryPack): Record<ModuleFlag, boolean> {
  const enabled = new Set<ModuleFlag>(pack.enabledModules)
  const modules = {} as Record<ModuleFlag, boolean>
  for (const key of MODULE_FLAGS) {
    modules[key] = enabled.has(key)
  }
  return modules
}

function mergeDocumentKinds(pack: IndustryPack): OrgFeatureFlags['documentKinds'] {
  const base = defaultDocumentKinds()
  if (!pack.documentKinds) return base
  return parseDocumentKinds({
    sales: { ...base.sales, ...pack.documentKinds.sales },
    purchases: { ...base.purchases, ...pack.documentKinds.purchases },
    inventory: { ...base.inventory, ...pack.documentKinds.inventory },
    accounting: { ...base.accounting, ...pack.documentKinds.accounting },
    employees: { ...base.employees, ...pack.documentKinds.employees },
    customers: { ...base.customers, ...pack.documentKinds.customers },
    stores: { ...base.stores, ...pack.documentKinds.stores },
  })
}

/**
 * Pure resolve — no I/O. Safe to call on every request; result is a plain object.
 */
export function resolveFeatureFlagsFromPack(
  pack: IndustryPack,
  previous: OrgFeatureFlags | null,
  options: PackInstallOptions = {},
): OrgFeatureFlags {
  const replaceGrants = options.replaceGrants !== false
  const packModules = modulesFromPack(pack)
  const prior = previous ?? structuredClone(DEFAULT_FEATURE_FLAGS)

  let modules: Record<ModuleFlag, boolean>
  let grantedModules: Record<ModuleFlag, boolean>

  if (replaceGrants) {
    const next = featureFlagsWithModules(packModules)
    modules = next.modules
    grantedModules = next.grantedModules
  } else {
    grantedModules = prior.grantedModules
    modules = modulesClampedToGrants(packModules, grantedModules)
  }

  const behavioral = pack.behavioral ?? {}

  return {
    ...prior,
    allowJournalDelete: prior.allowJournalDelete,
    allowCustomerDelete: prior.allowCustomerDelete,
    allowVendorDelete: prior.allowVendorDelete,
    allowItemDelete: prior.allowItemDelete,
    allowAccountDelete: prior.allowAccountDelete,
    allowDocumentDelete: prior.allowDocumentDelete,
    showCreatorBrand: prior.showCreatorBrand,
    enableTax: behavioral.enableTax ?? prior.enableTax,
    enableCustomerPortal: behavioral.enableCustomerPortal ?? prior.enableCustomerPortal,
    enableDocumentApprovals:
      behavioral.enableDocumentApprovals ?? prior.enableDocumentApprovals,
    creditLimitWarn: behavioral.creditLimitWarn ?? prior.creditLimitWarn,
    payrollStandard: behavioral.payrollStandard ?? prior.payrollStandard,
    closeHardGates: behavioral.closeHardGates ?? prior.closeHardGates,
    grantedModules,
    modules,
    documentKinds: mergeDocumentKinds(pack),
  }
}

export function packHasAnyModule(pack: IndustryPack): boolean {
  return pack.enabledModules.length > 0
}
