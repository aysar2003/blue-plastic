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

export type LauncherApp = {
  key: string
  label: string
  href: string
  icon: LauncherIcon
  permission?: Permission
  /** CSS colour used for the icon mark inside the white tile. */
  accent: string
  /** Soft wash behind the icon. */
  wash: string
}

export const LAUNCHER_APPS: LauncherApp[] = [
  {
    key: 'sales',
    label: 'Sales',
    href: '/sales',
    icon: 'receipt',
    permission: 'invoice:read',
    accent: '#0F766E',
    wash: '#CCFBF1',
  },
  {
    key: 'customers',
    label: 'Customers',
    href: '/customers',
    icon: 'users',
    permission: 'customer:read',
    accent: '#0369A1',
    wash: '#E0F2FE',
  },
  {
    key: 'purchases',
    label: 'Purchases',
    href: '/purchases/bills',
    icon: 'shopping-cart',
    permission: 'bill:read',
    accent: '#C2410C',
    wash: '#FFEDD5',
  },
  {
    key: 'vendors',
    label: 'Vendors',
    href: '/vendors',
    icon: 'building',
    permission: 'vendor:read',
    accent: '#B45309',
    wash: '#FEF3C7',
  },
  {
    key: 'banking',
    label: 'Banking',
    href: '/banking',
    icon: 'wallet',
    permission: 'bank:read',
    accent: '#047857',
    wash: '#D1FAE5',
  },
  {
    key: 'payments',
    label: 'Payments',
    href: '/payments',
    icon: 'hand-coins',
    permission: 'payment:read',
    accent: '#0E7490',
    wash: '#CFFAFE',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    href: '/items',
    icon: 'package',
    permission: 'item:read',
    accent: '#1D4ED8',
    wash: '#DBEAFE',
  },
  {
    key: 'accounting',
    label: 'Accounting',
    href: '/accounts',
    icon: 'book',
    permission: 'account:read',
    accent: '#1E3A5F',
    wash: '#E2E8F0',
  },
  {
    key: 'journals',
    label: 'Journals',
    href: '/journals',
    icon: 'notebook',
    permission: 'journal:read',
    accent: '#334155',
    wash: '#F1F5F9',
  },
  {
    key: 'reports',
    label: 'Reports',
    href: '/reports',
    icon: 'trending',
    permission: 'report:read',
    accent: '#BE123C',
    wash: '#FFE4E6',
  },
  {
    key: 'bill-payments',
    label: 'Bill payments',
    href: '/bill-payments',
    icon: 'banknote',
    permission: 'expense:read',
    accent: '#A16207',
    wash: '#FEF9C3',
  },
  {
    key: 'periods',
    label: 'Periods',
    href: '/periods',
    icon: 'calendar',
    permission: 'period:read',
    accent: '#475569',
    wash: '#E2E8F0',
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/settings/organization',
    icon: 'settings',
    permission: 'org:read',
    accent: '#57534E',
    wash: '#F5F5F4',
  },
  {
    key: 'help',
    label: 'Help',
    href: '/help',
    icon: 'help',
    accent: '#0F766E',
    wash: '#F0FDFA',
  },
]

export function appsForPermissions(permissions: ReadonlySet<string> | Iterable<string>): LauncherApp[] {
  const allowed = permissions instanceof Set ? permissions : new Set(permissions)
  return LAUNCHER_APPS.filter((app) => !app.permission || allowed.has(app.permission))
}
