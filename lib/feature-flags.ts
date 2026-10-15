/**
 * Organisation feature switches — Odoo-style Configuration toggles.
 * Stored as JSON on `Organization.featureFlags`; missing keys fall back to defaults.
 *
 * Each launcher app (except Settings / Help / Dashboard) has its own on/off switch
 * so a company can open or close apps one by one.
 */

/** Every company app that can be turned on or off. */
export type ModuleFlag =
  | 'pos'
  | 'sales'
  | 'projects'
  | 'customers'
  | 'purchases'
  | 'vendors'
  | 'banking'
  | 'payments'
  | 'inventory'
  | 'barcodes'
  | 'stores'
  | 'approvals'
  | 'accounting'
  | 'journals'
  | 'reports'
  | 'bill-payments'
  | 'periods'
  | 'calendar'
  | 'databases'

/** Ordered list for Apps & features and Databases → Limits. */
export const MODULE_FLAGS: readonly ModuleFlag[] = [
  'pos',
  'sales',
  'projects',
  'customers',
  'purchases',
  'vendors',
  'banking',
  'payments',
  'bill-payments',
  'inventory',
  'barcodes',
  'stores',
  'approvals',
  'accounting',
  'journals',
  'periods',
  'reports',
  'calendar',
  'databases',
] as const

export const MODULE_FLAG_LABELS: Record<ModuleFlag, { label: string; hint: string }> = {
  pos: { label: 'Point of Sale', hint: 'Registers and till' },
  sales: { label: 'Sales', hint: 'Estimates, orders, invoices, receipts' },
  projects: { label: 'Projects', hint: 'Customer job folders' },
  customers: { label: 'Customers', hint: 'Who you sell to' },
  purchases: { label: 'Purchases', hint: 'Bills, expenses, purchase orders' },
  vendors: { label: 'Vendors', hint: 'Who you buy from' },
  banking: { label: 'Banking', hint: 'Accounts, transfers, deposits' },
  payments: { label: 'Payments', hint: 'Money received from customers' },
  'bill-payments': { label: 'Bill payments', hint: 'Money paid to vendors' },
  inventory: { label: 'Inventory', hint: 'Products and stock' },
  barcodes: { label: 'Barcodes', hint: 'Labels and printing' },
  stores: { label: 'Store', hint: 'Quantity by warehouse' },
  approvals: { label: 'Approvals', hint: 'Maker-checker inbox' },
  accounting: { label: 'Accounting', hint: 'Chart of accounts hub' },
  journals: { label: 'Journals', hint: 'Manual ledger entries' },
  periods: { label: 'Periods', hint: 'Close the books' },
  reports: { label: 'Reports', hint: 'Financial and operations reports' },
  calendar: { label: 'Calendar', hint: 'Meetings and reminders' },
  databases: { label: 'Databases', hint: 'Companies and backups' },
}

/**
 * Older saves only had the seven “family” apps. New apps inherit that parent
 * until the company saves Apps & features again with an explicit value.
 */
const LEGACY_PARENT: Partial<Record<ModuleFlag, ModuleFlag>> = {
  projects: 'sales',
  customers: 'sales',
  payments: 'sales',
  vendors: 'purchases',
  'bill-payments': 'purchases',
  barcodes: 'inventory',
  stores: 'inventory',
  journals: 'accounting',
  periods: 'accounting',
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
  /**
   * Maker-checker approvals (SOX / COSO). When on, posting sales/purchases
   * (and other gated transactions) wait in Approvals until an authorised
   * checker posts them. POS till sales still post immediately.
   */
  enableDocumentApprovals: boolean
  /** Apps visible in the launcher / header when enabled. */
  modules: Record<ModuleFlag, boolean>
}

function allModules(on: boolean): Record<ModuleFlag, boolean> {
  return Object.fromEntries(MODULE_FLAGS.map((key) => [key, on])) as Record<ModuleFlag, boolean>
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
  enableDocumentApprovals: false,
  modules: allModules(true),
}

/** Form field for a module flag: sales → moduleSales, bill-payments → moduleBillPayments. */
export function moduleFormKey(flag: ModuleFlag): string {
  const camel = flag.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
  return `module${camel.charAt(0).toUpperCase()}${camel.slice(1)}`
}

export const MODULE_FORM_KEYS: Record<ModuleFlag, string> = Object.fromEntries(
  MODULE_FLAGS.map((key) => [key, moduleFormKey(key)]),
) as Record<ModuleFlag, string>

/** Every module form field name (for unchecked → false on save). */
export const MODULE_FORM_KEY_LIST: readonly string[] = MODULE_FLAGS.map((key) => MODULE_FORM_KEYS[key])

/**
 * Map app chrome / launcher keys → feature flag.
 * Settings, Help, and Dashboard stay always available (null).
 */
export const MODULE_KEY_TO_FLAG: Record<string, ModuleFlag | null> = {
  dashboard: null,
  settings: null,
  help: null,
  pos: 'pos',
  sales: 'sales',
  projects: 'projects',
  customers: 'customers',
  purchases: 'purchases',
  vendors: 'vendors',
  banking: 'banking',
  payments: 'payments',
  inventory: 'inventory',
  barcodes: 'barcodes',
  stores: 'stores',
  approvals: 'approvals',
  accounting: 'accounting',
  journals: 'journals',
  reports: 'reports',
  'bill-payments': 'bill-payments',
  periods: 'periods',
  calendar: 'calendar',
  databases: 'databases',
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
  if (typeof data.enableDocumentApprovals === 'boolean') {
    base.enableDocumentApprovals = data.enableDocumentApprovals
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
    for (const key of MODULE_FLAGS) {
      if (typeof modules[key] === 'boolean') base.modules[key] = modules[key]
    }
    // Fill apps that were never saved from their old parent family flag.
    for (const key of MODULE_FLAGS) {
      if (typeof modules[key] === 'boolean') continue
      const parent = LEGACY_PARENT[key]
      if (parent && typeof modules[parent] === 'boolean') {
        base.modules[key] = modules[parent]
      }
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

/** Payload keys Databases actions expect for company apps. */
export function moduleActionFields(modules: Record<ModuleFlag, boolean>): Record<string, boolean> {
  const fields: Record<string, boolean> = {}
  for (const key of MODULE_FLAGS) {
    fields[MODULE_FORM_KEYS[key]] = modules[key]
  }
  return fields
}
