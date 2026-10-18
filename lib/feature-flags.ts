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
  projects: { label: 'Projects', hint: 'Jobs, tasks, and linked sales' },
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
  /**
   * Apps the ERP system owner granted this company (create / Limits / approve).
   * The company may turn granted apps off for its own screens, but cannot turn
   * on an app that was never granted — that needs a request the owner accepts.
   */
  grantedModules: Record<ModuleFlag, boolean>
  /** Apps visible in the launcher / header when enabled (subset of grants). */
  modules: Record<ModuleFlag, boolean>
  /**
   * Lowest layer under Sales / Purchases / Inventory — turn individual document
   * kinds on or off without disabling the whole app. Missing keys mean on.
   */
  documentKinds: DocumentKindsFlags
}

/** Sales document kinds a company can hide under Apps & features. */
export const SALES_DOCUMENT_KINDS = [
  'INVOICE',
  'ESTIMATE',
  'QUOTATION',
  'SALES_ORDER',
  'SALES_RECEIPT',
  'CREDIT_MEMO',
  'REFUND_RECEIPT',
  'DELIVERY',
] as const
export type SalesDocumentKind = (typeof SALES_DOCUMENT_KINDS)[number]

/** Purchase document kinds a company can hide under Apps & features. */
export const PURCHASE_DOCUMENT_KINDS = [
  'BILL',
  'EXPENSE',
  'VENDOR_CREDIT',
  'PURCHASE_ORDER',
  'DELIVERY',
] as const
export type PurchaseDocumentKind = (typeof PURCHASE_DOCUMENT_KINDS)[number]

/** Inventory work areas a company can hide under Apps & features. */
export const INVENTORY_DOCUMENT_KINDS = ['products', 'adjustments', 'transfers'] as const
export type InventoryDocumentKind = (typeof INVENTORY_DOCUMENT_KINDS)[number]

export type DocumentKindFamily = 'sales' | 'purchases' | 'inventory'

export type DocumentKindsFlags = {
  sales: Record<SalesDocumentKind, boolean>
  purchases: Record<PurchaseDocumentKind, boolean>
  inventory: Record<InventoryDocumentKind, boolean>
}

export const DOCUMENT_KIND_LABELS: {
  sales: Record<SalesDocumentKind, string>
  purchases: Record<PurchaseDocumentKind, string>
  inventory: Record<InventoryDocumentKind, string>
} = {
  sales: {
    INVOICE: 'Invoices',
    ESTIMATE: 'Estimates',
    QUOTATION: 'Quotations',
    SALES_ORDER: 'Sales orders',
    SALES_RECEIPT: 'Sales receipts',
    CREDIT_MEMO: 'Credit memos',
    REFUND_RECEIPT: 'Refunds',
    DELIVERY: 'Delivery',
  },
  purchases: {
    BILL: 'Bills',
    EXPENSE: 'Expenses',
    VENDOR_CREDIT: 'Vendor credits',
    PURCHASE_ORDER: 'Purchase orders',
    DELIVERY: 'Delivery',
  },
  inventory: {
    products: 'Products & categories',
    adjustments: 'Stock adjustments & builds',
    transfers: 'Store transfers',
  },
}

function allSalesKinds(on: boolean): Record<SalesDocumentKind, boolean> {
  return Object.fromEntries(SALES_DOCUMENT_KINDS.map((key) => [key, on])) as Record<
    SalesDocumentKind,
    boolean
  >
}

function allPurchaseKinds(on: boolean): Record<PurchaseDocumentKind, boolean> {
  return Object.fromEntries(PURCHASE_DOCUMENT_KINDS.map((key) => [key, on])) as Record<
    PurchaseDocumentKind,
    boolean
  >
}

function allInventoryKinds(on: boolean): Record<InventoryDocumentKind, boolean> {
  return Object.fromEntries(INVENTORY_DOCUMENT_KINDS.map((key) => [key, on])) as Record<
    InventoryDocumentKind,
    boolean
  >
}

export function defaultDocumentKinds(): DocumentKindsFlags {
  return {
    sales: allSalesKinds(true),
    purchases: allPurchaseKinds(true),
    inventory: allInventoryKinds(true),
  }
}

/** Hub / menu tile key → sales document kind (tiles without a kind always show). */
export const SALES_HUB_KIND: Partial<Record<string, SalesDocumentKind>> = {
  estimates: 'ESTIMATE',
  quotations: 'QUOTATION',
  'sales-orders': 'SALES_ORDER',
  invoices: 'INVOICE',
  'sales-receipts': 'SALES_RECEIPT',
  delivery: 'DELIVERY',
  'credit-memos': 'CREDIT_MEMO',
  refunds: 'REFUND_RECEIPT',
}

/** Hub / menu tile key → purchase document kind. */
export const PURCHASE_HUB_KIND: Partial<Record<string, PurchaseDocumentKind>> = {
  bills: 'BILL',
  expenses: 'EXPENSE',
  'vendor-credits': 'VENDOR_CREDIT',
  'purchase-orders': 'PURCHASE_ORDER',
  delivery: 'DELIVERY',
}

/** Hub / menu tile key → inventory document kind. */
export const INVENTORY_HUB_KIND: Partial<Record<string, InventoryDocumentKind>> = {
  items: 'products',
  categories: 'products',
  stock: 'products',
  adjust: 'adjustments',
  builds: 'adjustments',
  stores: 'transfers',
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
  grantedModules: allModules(true),
  modules: allModules(true),
  documentKinds: defaultDocumentKinds(),
}

/** Form field for a document kind: sales + INVOICE → kindSales_INVOICE. */
export function documentKindFormKey(family: DocumentKindFamily, kind: string): string {
  const camel = family.charAt(0).toUpperCase() + family.slice(1)
  return `kind${camel}_${kind}`
}

export const DOCUMENT_KIND_FORM_KEY_LIST: readonly string[] = [
  ...SALES_DOCUMENT_KINDS.map((kind) => documentKindFormKey('sales', kind)),
  ...PURCHASE_DOCUMENT_KINDS.map((kind) => documentKindFormKey('purchases', kind)),
  ...INVENTORY_DOCUMENT_KINDS.map((kind) => documentKindFormKey('inventory', kind)),
]

/**
 * Path prefixes → app flag. Used to refuse URLs for apps this company may not use.
 * Longer prefixes win when several match.
 */
export const MODULE_PATH_PREFIXES: readonly { prefix: string; module: ModuleFlag }[] = [
  { prefix: '/pos', module: 'pos' },
  { prefix: '/sales', module: 'sales' },
  { prefix: '/projects', module: 'projects' },
  { prefix: '/customers', module: 'customers' },
  { prefix: '/purchases', module: 'purchases' },
  { prefix: '/vendors', module: 'vendors' },
  { prefix: '/banking', module: 'banking' },
  { prefix: '/payments', module: 'payments' },
  { prefix: '/bill-payments', module: 'bill-payments' },
  { prefix: '/inventory', module: 'inventory' },
  { prefix: '/items', module: 'inventory' },
  { prefix: '/barcodes', module: 'barcodes' },
  { prefix: '/stores', module: 'stores' },
  { prefix: '/store', module: 'stores' },
  { prefix: '/approvals', module: 'approvals' },
  { prefix: '/accounting', module: 'accounting' },
  { prefix: '/accounts', module: 'accounting' },
  { prefix: '/journals', module: 'journals' },
  { prefix: '/periods', module: 'periods' },
  { prefix: '/reports', module: 'reports' },
  { prefix: '/calendar', module: 'calendar' },
  { prefix: '/databases', module: 'databases' },
] as const

/** Which app owns this pathname, if any (Settings / Help / Home are unowned). */
export function moduleForPath(pathname: string): ModuleFlag | null {
  const path = pathname.split(/[?#]/)[0] || '/'
  let best: { module: ModuleFlag; length: number } | null = null
  for (const entry of MODULE_PATH_PREFIXES) {
    if (path === entry.prefix || path.startsWith(`${entry.prefix}/`)) {
      if (!best || entry.prefix.length > best.length) {
        best = { module: entry.module, length: entry.prefix.length }
      }
    }
  }
  return best?.module ?? null
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

  // Grants: explicit map, or copy of modules for older companies (whatever was
  // on when they last saved is treated as what the owner allowed).
  if (data.grantedModules && typeof data.grantedModules === 'object') {
    const granted = data.grantedModules as Record<string, unknown>
    for (const key of MODULE_FLAGS) {
      if (typeof granted[key] === 'boolean') base.grantedModules[key] = granted[key]
    }
  } else {
    base.grantedModules = { ...base.modules }
  }

  // A module that was never granted cannot stay "on".
  for (const key of MODULE_FLAGS) {
    if (!base.grantedModules[key]) base.modules[key] = false
  }

  if (data.documentKinds && typeof data.documentKinds === 'object') {
    const kinds = data.documentKinds as Record<string, unknown>
    base.documentKinds = parseDocumentKinds(kinds)
  }

  return base
}

function parseKindMap<T extends string>(
  raw: unknown,
  keys: readonly T[],
  fallback: Record<T, boolean>,
): Record<T, boolean> {
  const next = { ...fallback }
  if (!raw || typeof raw !== 'object') return next
  const data = raw as Record<string, unknown>
  for (const key of keys) {
    if (typeof data[key] === 'boolean') next[key] = data[key]
  }
  return next
}

/** Merge a partial documentKinds blob; missing families/keys stay on. */
export function parseDocumentKinds(raw: unknown): DocumentKindsFlags {
  const base = defaultDocumentKinds()
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Record<string, unknown>
  return {
    sales: parseKindMap(data.sales, SALES_DOCUMENT_KINDS, base.sales),
    purchases: parseKindMap(data.purchases, PURCHASE_DOCUMENT_KINDS, base.purchases),
    inventory: parseKindMap(data.inventory, INVENTORY_DOCUMENT_KINDS, base.inventory),
  }
}

/** True when this document kind is on (default true when unset). */
export function isDocumentKindEnabled(
  flags: OrgFeatureFlags,
  family: DocumentKindFamily,
  kind: string,
): boolean {
  const map = flags.documentKinds?.[family] as Record<string, boolean> | undefined
  if (!map || !(kind in map)) return true
  return map[kind] !== false
}

/** Read document kinds from features form checkboxes. */
export function documentKindsFromFormValues(
  values: Record<string, unknown>,
): DocumentKindsFlags {
  const kinds = defaultDocumentKinds()
  for (const kind of SALES_DOCUMENT_KINDS) {
    const raw = values[documentKindFormKey('sales', kind)]
    kinds.sales[kind] = raw === true || raw === 'true' || raw === 'on'
  }
  for (const kind of PURCHASE_DOCUMENT_KINDS) {
    const raw = values[documentKindFormKey('purchases', kind)]
    kinds.purchases[kind] = raw === true || raw === 'true' || raw === 'on'
  }
  for (const kind of INVENTORY_DOCUMENT_KINDS) {
    const raw = values[documentKindFormKey('inventory', kind)]
    kinds.inventory[kind] = raw === true || raw === 'true' || raw === 'on'
  }
  return kinds
}

/** Path → document kind for route guards (null = no kind gate). */
export function documentKindForPath(
  pathname: string,
): { family: DocumentKindFamily; kind: string } | null {
  const path = pathname.split(/[?#]/)[0] || '/'
  const sales = path.match(
    /^\/sales\/(invoices|estimates|quotations|sales-orders|sales-receipts|credit-memos|refunds|delivery)(?:\/|$)/,
  )
  if (sales) {
    const slug = sales[1]!
    const kind =
      slug === 'invoices'
        ? 'INVOICE'
        : slug === 'estimates'
          ? 'ESTIMATE'
          : slug === 'quotations'
            ? 'QUOTATION'
            : slug === 'sales-orders'
              ? 'SALES_ORDER'
              : slug === 'sales-receipts'
                ? 'SALES_RECEIPT'
                : slug === 'credit-memos'
                  ? 'CREDIT_MEMO'
                  : slug === 'refunds'
                    ? 'REFUND_RECEIPT'
                    : 'DELIVERY'
    return { family: 'sales', kind }
  }
  const purchases = path.match(
    /^\/purchases\/(bills|expenses|vendor-credits|purchase-orders|delivery|purchase-receipts)(?:\/|$)/,
  )
  if (purchases) {
    const slug = purchases[1]!
    const kind =
      slug === 'bills'
        ? 'BILL'
        : slug === 'expenses' || slug === 'purchase-receipts'
          ? 'EXPENSE'
          : slug === 'vendor-credits'
            ? 'VENDOR_CREDIT'
            : slug === 'purchase-orders'
              ? 'PURCHASE_ORDER'
              : 'DELIVERY'
    return { family: 'purchases', kind }
  }
  if (path === '/items' || path.startsWith('/items/')) {
    return { family: 'inventory', kind: 'products' }
  }
  if (path.startsWith('/inventory/adjustments') || path.startsWith('/inventory/builds')) {
    return { family: 'inventory', kind: 'adjustments' }
  }
  if (path.startsWith('/stores/transfer') || path === '/stores/transfer') {
    return { family: 'inventory', kind: 'transfers' }
  }
  return null
}

export function isModuleEnabled(flags: OrgFeatureFlags, moduleKey: string): boolean {
  const flag = MODULE_KEY_TO_FLAG[moduleKey]
  if (!flag) return true
  return flags.grantedModules[flag] !== false && flags.modules[flag] !== false
}

/** True when the system owner has granted this app (whether or not the company left it on). */
export function isModuleGranted(flags: OrgFeatureFlags, moduleKey: string): boolean {
  const flag = MODULE_KEY_TO_FLAG[moduleKey]
  if (!flag) return true
  return flags.grantedModules[flag] !== false
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
  const next = { ...DEFAULT_FEATURE_FLAGS.modules, ...modules }
  return {
    ...structuredClone(DEFAULT_FEATURE_FLAGS),
    grantedModules: { ...next },
    modules: { ...next },
  }
}

/**
 * Company Apps & features save: only granted apps may be turned on; ungranted
 * stay off. Grants themselves are never changed here.
 */
export function modulesClampedToGrants(
  requested: Record<ModuleFlag, boolean>,
  granted: Record<ModuleFlag, boolean>,
): Record<ModuleFlag, boolean> {
  const modules = { ...requested }
  for (const key of MODULE_FLAGS) {
    if (!granted[key]) modules[key] = false
  }
  return modules
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
