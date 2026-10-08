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
}

export const LAUNCHER_APPS: LauncherApp[] = [
  {
    key: 'pos',
    label: 'Point of Sale',
    href: '/pos',
    icon: 'monitor',
    glyph: 'pos',
    permission: 'pos:read',
    accent: '#714B67',
    wash: '#F3E8F0',
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
    blurb: 'Invoices and receipts',
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
    key: 'stores',
    label: 'Store',
    href: '/stores',
    icon: 'building',
    glyph: 'stores',
    permission: 'inventory:read',
    accent: '#0F766E',
    wash: '#CCFBF1',
    blurb: 'Quantity by warehouse',
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
    key: 'bill-payments',
    label: 'Bill payments',
    href: '/bill-payments',
    icon: 'banknote',
    glyph: 'bill-payments',
    permission: 'expense:read',
    accent: '#A16207',
    wash: '#FEF9C3',
    blurb: 'Money paid out',
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
  inventory: ['/items'],
  accounting: ['/accounts'],
}

export function appsForPermissions(permissions: ReadonlySet<string> | Iterable<string>): LauncherApp[] {
  const allowed = permissions instanceof Set ? permissions : new Set(permissions)
  return LAUNCHER_APPS.filter((app) => !app.permission || allowed.has(app.permission))
}
