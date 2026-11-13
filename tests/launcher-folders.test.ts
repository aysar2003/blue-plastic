import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))

import { AppLauncher } from '@/components/layout/app-launcher'
import {
  LAUNCHER_APPS,
  LAUNCHER_FOLDERS,
  appsForPermissions,
  orderHomeApps,
} from '@/components/layout/launcher-apps'

describe('launcher home apps', () => {
  it('places every launcher app in exactly one home-order group', () => {
    const keys = LAUNCHER_APPS.map((app) => app.key)
    const placed = LAUNCHER_FOLDERS.flatMap((folder) => [...folder.appKeys])
    expect(new Set(placed).size).toBe(placed.length)
    expect([...placed].sort()).toEqual([...keys].sort())
  })

  it('keeps related apps next to each other on the flat home grid', () => {
    const home = orderHomeApps(
      appsForPermissions(
        LAUNCHER_APPS.flatMap((app) => (app.permission ? [app.permission] : [])),
        { includeNested: true },
      ),
    ).map((app) => app.key)
    const purchase = home.indexOf('purchases')
    const bills = home.indexOf('bill-payments')
    const vendors = home.indexOf('vendors')
    expect(purchase).toBeGreaterThanOrEqual(0)
    expect(Math.abs(bills - purchase)).toBeLessThanOrEqual(5)
    expect(Math.abs(vendors - purchase)).toBeLessThanOrEqual(5)
  })

  it('renders ON apps flat like Odoo, with Apps manager tile', () => {
    const homeApps = orderHomeApps(
      appsForPermissions(
        LAUNCHER_APPS.flatMap((app) => (app.permission ? [app.permission] : [])),
        { includeNested: true },
      ),
    )
    const html = renderToStaticMarkup(
      createElement(AppLauncher, {
        eyebrow: 'Shop',
        title: 'Welcome',
        subtitle: 'Choose',
        apps: homeApps,
        homeMenu: true,
        manageAppsHref: '/settings/features',
      }),
    )
    expect(html).toContain('Point of Sale')
    expect(html).toContain('Bill payments')
    expect(html).toContain('>Apps<')
    expect(html).toContain('/settings/features')
    expect(html).not.toContain('Open Sales folder')
  })
})
