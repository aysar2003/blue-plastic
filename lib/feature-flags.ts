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

/** Ordered list for system-owner app allow / lock UI. */
export const MODULE_FLAGS: readonly ModuleFlag[] = [
  'sales',
  'purchases',
  'banking',
  'inventory',
  'pos',
  'accounting',
  'reports',
] as const

export const MODULE_FLAG_LABELS: Record<ModuleFlag, { label: string; hint: string }> = {
  sales: { label: 'Sales', hint: 'Invoices, customers, payments' },
  purchases: { label: 'Purchases', hint: 'Bills, vendors, expenses' },
  banking: { label: 'Banking', hint: 'Accounts, transfers, deposits' },
  inventory: { label: 'Inventory', hint: 'Products, stock, stores' },
  pos: { label: 'Point of Sale', hint: 'Registers and till' },
  accounting: { label: 'Accounting', hint: 'Chart, journals, periods' },
  reports: { label: 'Reports', hint: 'Financial and operations reports' },
}

/** Creator credit shown on shell and sign-in when enabled. */
export const CREATOR_BRAND_NAME = 'Abdisalam Abdullahi Mohamed'

export type OrgFeatureFlags = {
  /** Show Delete on journals (list + detail) and allow journal:reverse delete path. */
  allowJournalDelete: boolean
  /** Show Delete / Merge on customers (also needs customer:delete on the user). */
  allowCustomerDelete: boolean
  /** Show Delete / Merge on vendors (also needs vendor:delete on the user). */
  allowVendorDelete: boolean
  /** Show Delete / Merge on items (also needs item:delete on the user). */
  allowItemDelete: boolean
  /** Show Delete / Merge on chart accounts (also needs account:delete on the user). */
  allowAccountDelete: boolean
  /** Show Delete on sales/purchase documents, payments, banking, inventory adjustments. */
  allowDocumentDelete: boolean
  /** Show the creator credit on the shell footer and sign-in. */
  showCreatorBrand: boolean
  /**
   * Sales/purchase tax for this company. When off, tax settings, codes, line
   * tax, and tax reports stay hidden and the server will not apply tax.
   */
  enableTax: boolean
  /**
   * Customer self-service portal. When off, portal invites and /portal are
   * refused; staff UI for portal users stays hidden.
   */
  enableCustomerPortal: boolean
  /** Apps visible in the launcher / header when enabled. */
  modules: Record<ModuleFlag, boolean>
}

export const DEFAULT_FEATURE_FLAGS: OrgFeatureFlags = {
  allowJournalDelete: true,
  allowCustomerDelete: true,
  allowVendorDelete: true,
  allowItemDelete: true,
  allowAccountDelete: true,
  allowDocumentDelete: true,
  showCreatorBrand: true,
  enableTax: true,
  enableCustomerPortal: false,
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
  // Launcher-only apps follow the module they belong to.
  customers: 'sales',
  payments: 'sales',
  vendors: 'purchases',
  'bill-payments': 'purchases',
  stores: 'inventory',
  barcodes: 'inventory',
  journals: 'accounting',
  periods: 'accounting',
  calendar: null,
  databases: null,
}

export function parseFeatureFlags(raw: unknown): OrgFeatureFlags {
  const base = structuredClone(DEFAULT_FEATURE_FLAGS)
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Record<string, unknown>

  if (typeof data.allowJournalDelete === 'boolean') base.allowJournalDelete = data.allowJournalDelete
  if (typeof data.allowDocumentDelete === 'boolean') base.allowDocumentDelete = data.allowDocumentDelete
  if (typeof data.showCreatorBrand === 'boolean') base.showCreatorBrand = data.showCreatorBrand
  if (typeof data.enableTax === 'boolean') base.enableTax = data.enableTax
  if (typeof data.enableCustomerPortal === 'boolean') {
    base.enableCustomerPortal = data.enableCustomerPortal
  }

  // Legacy single switch → both contact sides until the new keys are saved.
  if (typeof data.allowContactDelete === 'boolean') {
    base.allowCustomerDelete = data.allowContactDelete
    base.allowVendorDelete = data.allowContactDelete
  }
  if (typeof data.allowCustomerDelete === 'boolean') base.allowCustomerDelete = data.allowCustomerDelete
  if (typeof data.allowVendorDelete === 'boolean') base.allowVendorDelete = data.allowVendorDelete
  if (typeof data.allowItemDelete === 'boolean') base.allowItemDelete = data.allowItemDelete
  if (typeof data.allowAccountDelete === 'boolean') base.allowAccountDelete = data.allowAccountDelete

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

/** Build a full modules map from checkboxes / JSON; missing keys stay on by default. */
export function parseModulesSelection(raw: unknown): Record<ModuleFlag, boolean> {
  const modules = { ...DEFAULT_FEATURE_FLAGS.modules }
  if (!raw || typeof raw !== 'object') return modules
  const data = raw as Record<string, unknown>
  for (const key of MODULE_FLAGS) {
    if (typeof data[key] === 'boolean') modules[key] = data[key]
  }
  return modules
}

/** At least one app must stay on — empty selection is not useful. */
export function hasAnyModuleEnabled(modules: Record<ModuleFlag, boolean>): boolean {
  return MODULE_FLAGS.some((key) => modules[key])
}

/** Merge module map into default feature flags (for signup approve / DB grants). */
export function featureFlagsWithModules(
  modules: Record<ModuleFlag, boolean>,
): OrgFeatureFlags {
  return {
    ...structuredClone(DEFAULT_FEATURE_FLAGS),
    modules: { ...DEFAULT_FEATURE_FLAGS.modules, ...modules },
  }
}

/** Form field names used on register + Features (moduleSales → sales). */
export const MODULE_FORM_KEYS: Record<ModuleFlag, string> = {
  sales: 'moduleSales',
  purchases: 'modulePurchases',
  banking: 'moduleBanking',
  inventory: 'moduleInventory',
  pos: 'modulePos',
  accounting: 'moduleAccounting',
  reports: 'moduleReports',
}

export function modulesFromFormValues(
  values: Record<string, unknown>,
): Record<ModuleFlag, boolean> {
  const modules = { ...DEFAULT_FEATURE_FLAGS.modules }
  for (const key of MODULE_FLAGS) {
    const formKey = MODULE_FORM_KEYS[key]
    const raw = values[formKey]
    modules[key] = raw === true || raw === 'true' || raw === 'on'
  }
  return modules
}
