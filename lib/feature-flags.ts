/**
 * Organisation feature switches — Odoo-style Configuration toggles.
 * Stored as JSON on `Organization.featureFlags`; missing keys fall back to defaults.
 */
export type ModuleFlag =
  | 'sales'
  | 'purchases'
  | 'banking'
  | 'inventory'
  | 'pos'
  | 'accounting'
  | 'reports'

/** Creator credit shown on shell and sign-in when enabled. */
export const CREATOR_BRAND_NAME = 'Abdisalm Hero'

export type OrgFeatureFlags = {
  /** Show Delete on journals (list + detail) and allow journal:reverse delete path. */
  allowJournalDelete: boolean
  /** Show Delete on customers and vendors (archives them; books stay reconstructible). */
  allowContactDelete: boolean
  /** Show Delete on sales/purchase documents, payments, banking, inventory adjustments. */
  allowDocumentDelete: boolean
  /** Show the creator brand name (Abdisalm Hero) on shell footer and sign-in. */
  showCreatorBrand: boolean
  /** Apps visible in the launcher / header when enabled. */
  modules: Record<ModuleFlag, boolean>
}

export const DEFAULT_FEATURE_FLAGS: OrgFeatureFlags = {
  allowJournalDelete: true,
  allowContactDelete: true,
  allowDocumentDelete: true,
  showCreatorBrand: true,
  modules: {
    sales: true,
    purchases: true,
    banking: true,
    inventory: true,
    pos: true,
    accounting: true,
    reports: true,
  },
}

/** Map app chrome module keys → feature flag module. */
export const MODULE_KEY_TO_FLAG: Record<string, ModuleFlag | null> = {
  dashboard: null,
  sales: 'sales',
  purchases: 'purchases',
  banking: 'banking',
  inventory: 'inventory',
  pos: 'pos',
  accounting: 'accounting',
  reports: 'reports',
  settings: null,
  help: null,
}

export function parseFeatureFlags(raw: unknown): OrgFeatureFlags {
  const base = structuredClone(DEFAULT_FEATURE_FLAGS)
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Record<string, unknown>

  if (typeof data.allowJournalDelete === 'boolean') base.allowJournalDelete = data.allowJournalDelete
  if (typeof data.allowContactDelete === 'boolean') base.allowContactDelete = data.allowContactDelete
  if (typeof data.allowDocumentDelete === 'boolean') base.allowDocumentDelete = data.allowDocumentDelete
  if (typeof data.showCreatorBrand === 'boolean') base.showCreatorBrand = data.showCreatorBrand

  if (data.modules && typeof data.modules === 'object') {
    const modules = data.modules as Record<string, unknown>
    for (const key of Object.keys(base.modules) as ModuleFlag[]) {
      if (typeof modules[key] === 'boolean') base.modules[key] = modules[key]
    }
  }

  return base
}

export function isModuleEnabled(flags: OrgFeatureFlags, moduleKey: string): boolean {
  const flag = MODULE_KEY_TO_FLAG[moduleKey]
  if (!flag) return true
  return flags.modules[flag] !== false
}
