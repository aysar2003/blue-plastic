import { LAUNCHER_APPS, type LauncherApp } from '@/components/layout/launcher-apps'
import {
  MODULE_FLAG_LABELS,
  MODULE_FLAGS,
  OPT_IN_MODULE_FLAGS,
  type ModuleFlag,
} from '@/lib/feature-flags'

/**
 * World-standard ERP app store categories (Odoo Apps / AppSource style).
 * Used by the Platform Console Apps catalog.
 */
export const APP_CATALOG_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'sales', label: 'Sales' },
  { id: 'purchases-stock', label: 'Purchases & Stock' },
  { id: 'finance', label: 'Finance' },
  { id: 'people', label: 'People' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'platform', label: 'Platform' },
] as const

export type AppCatalogCategoryId = (typeof APP_CATALOG_CATEGORIES)[number]['id']

const CATEGORY_BY_MODULE: Record<ModuleFlag, Exclude<AppCatalogCategoryId, 'all'>> = {
  pos: 'sales',
  sales: 'sales',
  projects: 'sales',
  customers: 'sales',
  payments: 'sales',
  purchases: 'purchases-stock',
  vendors: 'purchases-stock',
  'bill-payments': 'purchases-stock',
  inventory: 'purchases-stock',
  barcodes: 'purchases-stock',
  stores: 'purchases-stock',
  banking: 'finance',
  accounting: 'finance',
  journals: 'finance',
  periods: 'finance',
  reports: 'finance',
  approvals: 'finance',
  employees: 'people',
  planning: 'people',
  appointments: 'people',
  calendar: 'productivity',
  todos: 'productivity',
  documents: 'productivity',
  knowledge: 'productivity',
  sign: 'productivity',
  discuss: 'productivity',
  surveys: 'productivity',
  databases: 'platform',
}

const OPT_IN = new Set<ModuleFlag>(OPT_IN_MODULE_FLAGS)

const LAUNCHER_BY_KEY = new Map<string, LauncherApp>(
  LAUNCHER_APPS.map((app) => [app.key, app]),
)

export type PlatformCatalogApp = {
  key: ModuleFlag
  label: string
  hint: string
  category: Exclude<AppCatalogCategoryId, 'all'>
  categoryLabel: string
  optIn: boolean
  accent: string
  wash: string
  glyph: LauncherApp['glyph'] | null
}

function categoryLabel(id: Exclude<AppCatalogCategoryId, 'all'>): string {
  return APP_CATALOG_CATEGORIES.find((row) => row.id === id)?.label ?? id
}

/** Full installation catalog — one entry per grantable module. */
export function platformCatalogApps(): PlatformCatalogApp[] {
  return MODULE_FLAGS.map((key) => {
    const meta = MODULE_FLAG_LABELS[key]
    const launcher = LAUNCHER_BY_KEY.get(key)
    const category = CATEGORY_BY_MODULE[key]
    return {
      key,
      label: meta.label,
      hint: meta.hint,
      category,
      categoryLabel: categoryLabel(category),
      optIn: OPT_IN.has(key),
      accent: launcher?.accent ?? '#334155',
      wash: launcher?.wash ?? '#F1F5F9',
      glyph: launcher?.glyph ?? null,
    }
  })
}
