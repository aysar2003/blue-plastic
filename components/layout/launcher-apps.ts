import type { AppGlyphName } from '@/components/layout/app-glyphs'
import type { Permission } from '@/server/auth/permissions'

/**
 * Destinations on the home launcher. Each tile is a front door into work that
 * already has a route — this list is presentation, not a second navigation tree.
 *
 * Icons are named here as plain strings so a Server Component can pass the list
 * to a Client Component. The client maps the name to a Lucide component.
 */
export type LauncherIcon =
  | 'receipt'
  | 'users'
  | 'shopping-cart'
  | 'building'
  | 'wallet'
  | 'hand-coins'
  | 'package'
  | 'book'
  | 'notebook'
  | 'trending'
  | 'banknote'
  | 'calendar'
  | 'settings'
  | 'help'
  | 'scale'
  | 'clock'
  | 'percent'
  | 'clipboard'
  | 'sliders'
  | 'scroll'
  | 'palette'
  | 'file'
  | 'transfer'
  | 'monitor'
  | 'database'
  | 'barcode'

export type LauncherApp = {
  key: string
  label: string
  href: string
  icon: LauncherIcon
  /** Flat colour mark drawn on the dark app tile (home grid, Apps menu). */
  glyph: AppGlyphName
  permission?: Permission
  /** CSS colour used for the icon mark inside the white tile. */
  accent: string
  /** Soft wash behind the icon. */
  wash: string
  /** One-line purpose shown under the tile label on wider screens. */
  blurb?: string
  /**
   * Parent hub this destination already lives in (e.g. bill-payments → purchases).
   * Nested apps stay in Settings / feature flags, but are not separate Home or
   * Apps-bar tiles — open the parent app instead.
   */
  nestedIn?: string
}

export const LAUNCHER_APPS: LauncherApp[] = [
  {
    key: 'pos',
    label: 'Point of Sale',
    href: '/pos',
    icon: 'monitor',
    glyph: 'pos',
    permission: 'pos:read',
    accent: '#0e7490',
    wash: '#cffafe',
    blurb: 'Sell at the till',
  },
  {
    key: 'sales',
    label: 'Sales',
    href: '/sales',
    icon: 'receipt',
    glyph: 'sales',
    permission: 'invoice:read',
    accent: '#0F766E',
    wash: '#CCFBF1',
    blurb: 'Invoices and orders',
  },
  {
    key: 'projects',
    label: 'Projects',
    href: '/projects',
    icon: 'clipboard',
    glyph: 'projects',
    permission: 'project:read',
    accent: '#0369A1',
    wash: '#E0F2FE',
    blurb: 'Jobs and estimates',
  },
  {
    key: 'customers',
    label: 'Customers',
    href: '/customers',
    icon: 'users',
    glyph: 'customers',
    permission: 'customer:read',
    accent: '#0369A1',
    wash: '#E0F2FE',
    blurb: 'Who you sell to',
    nestedIn: 'sales',
  },
  {
    key: 'purchases',
    label: 'Purchases',
    href: '/purchases',
    icon: 'shopping-cart',
    glyph: 'purchases',
    permission: 'bill:read',
    accent: '#C2410C',
    wash: '#FFEDD5',
    blurb: 'Bills and expenses',
  },
  {
    key: 'vendors',
    label: 'Vendors',
    href: '/vendors',
    icon: 'building',
    glyph: 'vendors',
    permission: 'vendor:read',
    accent: '#B45309',
    wash: '#FEF3C7',
    blurb: 'Who you buy from',
    nestedIn: 'purchases',
  },
  {
    key: 'banking',
    label: 'Banking',
    href: '/banking',
    icon: 'wallet',
    glyph: 'banking',
    permission: 'bank:read',
    accent: '#047857',
    wash: '#D1FAE5',
    blurb: 'Cash and cards',
  },
  {
    key: 'payments',
    label: 'Payments',
    href: '/payments',
    icon: 'hand-coins',
    glyph: 'payments',
    permission: 'payment:read',
    accent: '#0E7490',
    wash: '#CFFAFE',
    blurb: 'Money received',
    nestedIn: 'sales',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    href: '/inventory',
    icon: 'package',
    glyph: 'inventory',
    permission: 'item:read',
    accent: '#1D4ED8',
    wash: '#DBEAFE',
    blurb: 'Products and stock',
  },
  {
    key: 'barcodes',
    label: 'Barcodes',
    href: '/barcodes',
    icon: 'barcode',
    glyph: 'barcodes',
    permission: 'item:read',
    accent: '#B45309',
    wash: '#FEF3C7',
    blurb: 'Generate and print labels',
    nestedIn: 'inventory',
  },
  {
    key: 'stores',
    label: 'Store',
    href: '/stores',
    icon: 'building',
    glyph: 'stores',
    permission: 'inventory:read',
    accent: '#0F766E',
    wash: '#CCFBF1',
    blurb: 'Quantity by warehouse',
    nestedIn: 'inventory',
  },
  {
    key: 'approvals',
    label: 'Approvals',
    href: '/approvals',
    icon: 'clipboard',
    glyph: 'approvals',
    permission: 'invoice:approve',
    accent: '#B45309',
    wash: '#FFEDD5',
    blurb: 'Pending, print, and post',
  },
  {
    key: 'accounting',
    label: 'Accounting',
    href: '/accounting',
    icon: 'book',
    glyph: 'accounting',
    permission: 'account:read',
    accent: '#1E3A5F',
    wash: '#E2E8F0',
    blurb: 'The ledger',
  },
  {
    key: 'journals',
    label: 'Journals',
    href: '/journals',
    icon: 'notebook',
    glyph: 'journals',
    permission: 'journal:read',
    accent: '#334155',
    wash: '#F1F5F9',
    blurb: 'Manual entries',
    nestedIn: 'accounting',
  },
  {
    key: 'reports',
    label: 'Reports',
    href: '/reports',
    icon: 'trending',
    glyph: 'reports',
    permission: 'report:read',
    accent: '#BE123C',
    wash: '#FFE4E6',
    blurb: 'The figures',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    href: '/analytics',
    icon: 'trending',
    glyph: 'analytics',
    permission: 'report:overview',
    accent: '#0F766E',
    wash: '#CCFBF1',
    blurb: 'Charts, candles, analysis',
  },
  {
    key: 'bill-payments',
    label: 'Bill payments',
    href: '/bill-payments',
    icon: 'banknote',
    glyph: 'bill-payments',
    permission: 'expense:read',
    accent: '#A16207',
    wash: '#FEF9C3',
    blurb: 'Money paid out',
    nestedIn: 'purchases',
  },
  {
    key: 'periods',
    label: 'Periods',
    href: '/periods',
    icon: 'calendar',
    glyph: 'periods',
    permission: 'period:read',
    accent: '#475569',
    wash: '#E2E8F0',
    blurb: 'Close the books',
    nestedIn: 'accounting',
  },
  {
    key: 'calendar',
    label: 'Calendar',
    href: '/calendar',
    icon: 'calendar',
    glyph: 'calendar',
    permission: 'calendar:read',
    accent: '#0369A1',
    wash: '#E0F2FE',
    blurb: 'Meetings and reminders',
  },
  {
    key: 'todos',
    label: 'To-do',
    href: '/todos',
    icon: 'clipboard',
    glyph: 'todos',
    permission: 'todo:read',
    accent: '#0F766E',
    wash: '#CCFBF1',
    blurb: 'Personal and team lists',
  },
  {
    key: 'documents',
    label: 'Documents',
    href: '/documents',
    icon: 'file',
    glyph: 'documents',
    permission: 'docs:read',
    accent: '#0369A1',
    wash: '#E0F2FE',
    blurb: 'Company file library',
  },
  {
    key: 'knowledge',
    label: 'Knowledge',
    href: '/knowledge',
    icon: 'book',
    glyph: 'knowledge',
    permission: 'knowledge:read',
    accent: '#0F766E',
    wash: '#CCFBF1',
    blurb: 'Internal wiki and how-tos',
  },
  {
    key: 'employees',
    label: 'Employees',
    href: '/employees',
    icon: 'users',
    glyph: 'employees',
    permission: 'hr:read',
    accent: '#7C3AED',
    wash: '#EDE9FE',
    blurb: 'Company people directory',
  },
  {
    key: 'sign',
    label: 'Sign',
    href: '/sign',
    icon: 'scroll',
    glyph: 'documents',
    permission: 'docs:read',
    accent: '#0369A1',
    wash: '#E0F2FE',
    blurb: 'Request signatures',
  },
  {
    key: 'appointments',
    label: 'Appointments',
    href: '/appointments',
    icon: 'calendar',
    glyph: 'calendar',
    permission: 'calendar:read',
    accent: '#0F766E',
    wash: '#CCFBF1',
    blurb: 'Bookable slots',
  },
  {
    key: 'discuss',
    label: 'Discuss',
    href: '/discuss',
    icon: 'users',
    glyph: 'knowledge',
    permission: 'org:read',
    accent: '#7C3AED',
    wash: '#EDE9FE',
    blurb: 'Team channels',
  },
  {
    key: 'planning',
    label: 'Planning',
    href: '/planning',
    icon: 'clipboard',
    glyph: 'projects',
    permission: 'project:read',
    accent: '#0369A1',
    wash: '#E0F2FE',
    blurb: 'Week from tasks',
  },
  {
    key: 'surveys',
    label: 'Surveys',
    href: '/surveys',
    icon: 'clipboard',
    glyph: 'todos',
    permission: 'org:read',
    accent: '#B45309',
    wash: '#FEF3C7',
    blurb: 'Forms and responses',
  },
  {
    key: 'databases',
    label: 'Databases',
    href: '/databases',
    icon: 'database',
    glyph: 'databases',
    permission: 'org:update',
    accent: '#0F766E',
    wash: '#CCFBF1',
    blurb: 'Companies and backups',
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: 'settings',
    glyph: 'settings',
    permission: 'org:read',
    accent: '#57534E',
    wash: '#F5F5F4',
    blurb: 'How the books are set',
  },
  {
    key: 'help',
    label: 'Help',
    href: '/help',
    icon: 'help',
    glyph: 'help',
    accent: '#0F766E',
    wash: '#F0FDFA',
    blurb: 'How it works',
  },
]

/** Paths that belong to an app whose own door uses a different prefix. */
export const APP_ALSO: Record<string, string[]> = {
  sales: ['/customers', '/payments'],
  purchases: ['/bill-payments', '/vendors'],
  inventory: ['/items', '/barcodes', '/stores'],
  barcodes: ['/barcodes/print'],
  accounting: ['/accounts', '/journals', '/periods'],
  databases: ['/settings/backup'],
}

/**
 * Home-launcher folders (Odoo-style). Click a folder to enter; apps inside stay
 * apps — Bill payments under Purchases & Stock, Banking under Finance, etc.
 */
export type LauncherFolderDef = {
  id: string
  label: string
  blurb: string
  appKeys: readonly string[]
}

/**
 * Related apps sit next to each other on the flat home grid (Odoo order),
 * without folder tiles. Productivity first, then sell / buy / books / people.
 */
export const LAUNCHER_FOLDERS: LauncherFolderDef[] = [
  {
    id: 'productivity',
    label: 'Productivity',
    blurb: 'Day-to-day work',
    appKeys: ['discuss', 'calendar', 'appointments', 'todos', 'knowledge', 'documents', 'sign', 'surveys'],
  },
  {
    id: 'sales',
    label: 'Sales',
    blurb: 'Sell and get paid',
    appKeys: ['sales', 'pos', 'projects', 'customers', 'payments'],
  },
  {
    id: 'purchases-stock',
    label: 'Purchases & Stock',
    blurb: 'Buy and hold',
    appKeys: ['purchases', 'vendors', 'inventory', 'barcodes', 'stores', 'bill-payments'],
  },
  {
    id: 'finance',
    label: 'Finance',
    blurb: 'Books and money',
    appKeys: ['accounting', 'banking', 'journals', 'periods', 'reports', 'analytics', 'approvals'],
  },
  {
    id: 'people',
    label: 'People',
    blurb: 'Staff and schedules',
    appKeys: ['employees', 'planning'],
  },
  {
    id: 'platform',
    label: 'Platform',
    blurb: 'Company and setup',
    appKeys: ['databases', 'settings', 'help'],
  },
]

/** Flat home order: related apps together, then any leftovers. */
export function orderHomeApps<T extends { key: string }>(apps: readonly T[]): T[] {
  const byKey = new Map(apps.map((app) => [app.key, app]))
  const ordered: T[] = []
  const seen = new Set<string>()
  for (const folder of LAUNCHER_FOLDERS) {
    for (const key of folder.appKeys) {
      const app = byKey.get(key)
      if (!app || seen.has(key)) continue
      ordered.push(app)
      seen.add(key)
    }
  }
  for (const app of apps) {
    if (seen.has(app.key)) continue
    ordered.push(app)
    seen.add(app.key)
  }
  return ordered
}

export type LauncherFolder = {
  id: string
  label: string
  blurb: string
  apps: LauncherApp[]
}

/**
 * Group visible apps into folders. A folder with only one app is promoted to
 * the top level so users are not forced through an extra click. Apps that are
 * not listed in any folder stay loose at the top.
 */
export function groupLauncherApps(apps: readonly LauncherApp[]): {
  folders: LauncherFolder[]
  loose: LauncherApp[]
} {
  const byKey = new Map(apps.map((app) => [app.key, app]))
  const placed = new Set<string>()
  const folders: LauncherFolder[] = []
  const loose: LauncherApp[] = []

  for (const folder of LAUNCHER_FOLDERS) {
    const inside = folder.appKeys
      .map((key) => byKey.get(key))
      .filter((app): app is LauncherApp => Boolean(app))
    for (const app of inside) placed.add(app.key)
    if (inside.length >= 2) {
      folders.push({
        id: folder.id,
        label: folder.label,
        blurb: folder.blurb,
        apps: inside,
      })
    } else if (inside.length === 1) {
      loose.push(inside[0]!)
    }
  }

  for (const app of apps) {
    if (!placed.has(app.key)) loose.push(app)
  }

  return { folders, loose }
}

export function appsForPermissions(
  permissions: ReadonlySet<string> | Iterable<string>,
  opts?: { includeNested?: boolean },
): LauncherApp[] {
  const allowed = permissions instanceof Set ? permissions : new Set(permissions)
  const includeNested = opts?.includeNested === true
  return LAUNCHER_APPS.filter((app) => {
    if (app.permission && !allowed.has(app.permission)) return false
    if (!includeNested && app.nestedIn) return false
    return true
  })
}
