import type { Permission } from '@/server/auth/permissions'
import type { LauncherIcon } from './launcher-apps'

/**
 * Destinations inside the Projects hub — job folders for a customer site.
 */
export type ProjectHubApp = {
  key: string
  label: string
  href: string
  icon: LauncherIcon
  permission?: Permission
  accent: string
  wash: string
  blurb: string
}

export const PROJECT_HUB_APPS: ProjectHubApp[] = [
  {
    key: 'all-projects',
    label: 'All projects',
    href: '/projects/list',
    icon: 'clipboard',
    permission: 'project:read',
    accent: '#0369A1',
    wash: '#E0F2FE',
    blurb: 'Register of jobs',
  },
  {
    key: 'new-project',
    label: 'New project',
    href: '/projects/new',
    icon: 'notebook',
    permission: 'project:create',
    accent: '#0F766E',
    wash: '#CCFBF1',
    blurb: 'Open a job folder',
  },
  {
    key: 'estimates',
    label: 'Estimates',
    href: '/sales/estimates',
    icon: 'book',
    permission: 'invoice:read',
    accent: '#22d3ee',
    wash: '#cffafe',
    blurb: 'Quotes for a job',
  },
  {
    key: 'sales-orders',
    label: 'Sales orders',
    href: '/sales/sales-orders',
    icon: 'receipt',
    permission: 'invoice:read',
    accent: '#C2410C',
    wash: '#FFEDD5',
    blurb: 'Confirmed work',
  },
  {
    key: 'invoices',
    label: 'Invoices',
    href: '/sales/invoices',
    icon: 'notebook',
    permission: 'invoice:read',
    accent: '#1D4ED8',
    wash: '#DBEAFE',
    blurb: 'Bill the customer',
  },
  {
    key: 'purchase-orders',
    label: 'Purchase orders',
    href: '/purchases/purchase-orders',
    icon: 'receipt',
    permission: 'bill:read',
    accent: '#7C3AED',
    wash: '#EDE9FE',
    blurb: 'Buy for the job',
  },
  {
    key: 'bills',
    label: 'Bills',
    href: '/purchases/bills',
    icon: 'book',
    permission: 'bill:read',
    accent: '#BE185D',
    wash: '#FCE7F3',
    blurb: 'Vendor costs',
  },
]

export function projectAppsForPermissions(
  permissions: ReadonlySet<string> | Iterable<string>,
): ProjectHubApp[] {
  const allowed = permissions instanceof Set ? permissions : new Set(permissions)
  return PROJECT_HUB_APPS.filter((app) => !app.permission || allowed.has(app.permission))
}
