import { describe, expect, it, vi } from 'vitest'

vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { reportSectionsFor } from '@/components/layout/report-apps'
import { menuForApp } from '@/components/layout/header-app-menus'
import { LAUNCHER_APPS } from '@/components/layout/launcher-apps'
import { MODULES } from '@/components/layout/nav-items'
import { visiblePosNav } from '@/components/pos/pos-shell'
import { reportMenuItems } from '@/components/reports/create-report-menu'
import {
  BUSINESS_OVERVIEW_HREF,
  canViewBusinessOverview,
  withoutBusinessOverview,
} from '@/lib/business-overview-access'
import { MANAGEMENT_REPORTS, STANDARD_FAVOURITES } from '@/lib/standard-reports'
import type { OrgContext } from '@/server/auth/context'
import { permissionsFor } from '@/server/auth/permissions'
import { businessOverview } from '@/server/services/business-overview'

function hrefs(items: { href: string }[]) {
  return items.map((item) => item.href)
}

function overviewLinks(permissions: Iterable<string>) {
  const reports = MODULES.find((entry) => entry.key === 'reports')
  const tabs = (reports?.tabs ?? []).filter(
    (tab) => !tab.permission || new Set(permissions).has(tab.permission),
  )
  const sections = reportSectionsFor(permissions).flatMap((section) => section.apps)
  const header = LAUNCHER_APPS.flatMap((app) => menuForApp(app.key, permissions))
  const pos = visiblePosNav(permissions).flatMap((item) => item.children ?? [])
  return {
    tabs: hrefs(tabs),
    sections: hrefs(sections),
    header: hrefs(header),
    pos: hrefs(pos),
    menu: hrefs(reportMenuItems(permissions)),
    favourites: hrefs(withoutBusinessOverview(STANDARD_FAVOURITES, permissions)),
    management: hrefs(withoutBusinessOverview(MANAGEMENT_REPORTS, permissions)),
  }
}

describe('business overview access', () => {
  const sales = permissionsFor('SALES')
  const accountant = permissionsFor('ACCOUNTANT')

  it('hides every business overview link from a seller', () => {
    const links = overviewLinks(sales)
    for (const list of Object.values(links)) {
      expect(list).not.toContain(BUSINESS_OVERVIEW_HREF)
    }
    expect(canViewBusinessOverview(sales)).toBe(false)
  })

  it('keeps the business overview link for an accountant', () => {
    const links = overviewLinks(accountant)
    expect(links.tabs).toContain(BUSINESS_OVERVIEW_HREF)
    expect(links.sections).toContain(BUSINESS_OVERVIEW_HREF)
    expect(links.pos).toContain(BUSINESS_OVERVIEW_HREF)
    expect(links.menu).toContain(BUSINESS_OVERVIEW_HREF)
    expect(links.favourites).toContain(BUSINESS_OVERVIEW_HREF)
    expect(links.management).toContain(BUSINESS_OVERVIEW_HREF)
    expect(canViewBusinessOverview(accountant)).toBe(true)
  })

  it('drops a bookmarked overview link, including one with a query', () => {
    const rows = [
      { href: '/reports/business-overview', label: 'Business overview' },
      { href: '/reports/business-overview?period=this-month', label: 'Snapshot' },
      { href: '/reports/profit-loss', label: 'Profit and Loss' },
    ]
    expect(withoutBusinessOverview(rows, sales).map((row) => row.href)).toEqual(['/reports/profit-loss'])
    expect(withoutBusinessOverview(rows, accountant)).toHaveLength(3)
  })

  it('still lists the other statements in the business overview group', () => {
    const section = reportSectionsFor(sales).find((item) => item.label === 'Business overview')
    expect(section?.apps.map((app) => app.href)).toEqual([
      '/reports/profit-loss',
      '/reports/balance-sheet',
      '/reports/cash-flow',
      '/reports/trial-balance',
    ])
  })

  it('refuses the overview figures when the caller lacks the capability', async () => {
    const ctx = { permissions: sales } as unknown as OrgContext
    await expect(businessOverview(ctx)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    })
  })
})
