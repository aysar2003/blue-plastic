import { MODULE_FLAGS, type ModuleFlag } from '@/lib/feature-flags'

/**
 * First-party app catalog. Installing flips a granted company module flag.
 * Untrusted third-party code is never loaded.
 */

export const MARKETPLACE_LEGAL =
  'First-party SOM ERP modules only. No third-party package is downloaded or executed. Install turns on an app the system owner already granted.'

export function isMarketplaceModule(value: string): value is ModuleFlag {
  return (MODULE_FLAGS as readonly string[]).includes(value)
}

export function canInstallApp(granted: boolean, currentlyOn: boolean): boolean {
  return granted && !currentlyOn
}

export function canUninstallApp(currentlyOn: boolean, enabledCount: number): boolean {
  return currentlyOn && enabledCount > 1
}
