/**
 * Public SOM ERP login doors — separate from the marketing website (`/`).
 * Each audience has its own URL so the site can deep-link straight in.
 */
export const LOGIN_HUB = '/login'
export const LOGIN_STAFF = '/login/staff'
export const LOGIN_COMPANY = '/login/company'
export const LOGIN_PORTAL = '/login/portal'

export const LOGIN_DOORS = [
  {
    href: LOGIN_STAFF,
    path: LOGIN_STAFF,
    title: 'SOM ERP staff',
    short: 'Staff',
    description: 'Installation owners — Databases and every company.',
  },
  {
    href: LOGIN_COMPANY,
    path: LOGIN_COMPANY,
    title: 'Company books',
    short: 'Company',
    description: 'Work inside one company — sales, stock, banking.',
  },
  {
    href: LOGIN_PORTAL,
    path: LOGIN_PORTAL,
    title: 'Customer portal',
    short: 'Portal',
    description: 'Customers view invoices and balances.',
  },
] as const

export const WRONG_DOOR = {
  staff: 'This account uses the company or customer portal login.',
  company: 'This account uses the SOM ERP staff login or the customer portal.',
  portal: 'This account uses the staff or company login, not the customer portal.',
} as const
