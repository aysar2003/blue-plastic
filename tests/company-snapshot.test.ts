import { describe, expect, it } from 'vitest'

import { LAUNCHER_APPS, LAUNCHER_FOLDERS } from '@/components/layout/launcher-apps'
import { MODULES } from '@/components/layout/nav-items'
import { reportSectionsFor } from '@/components/layout/report-apps'
import {
  BUSINESS_OVERVIEW_HREF,
  COMPANY_SNAPSHOT_HREF,
  COMPANY_SNAPSHOT_LEGACY_HREF,
  canViewBusinessOverview,
  withoutBusinessOverview,
} from '@/lib/business-overview-access'
import { MODULE_KEY_TO_FLAG, moduleForPath } from '@/lib/feature-flags'
import { permissionsFor } from '@/server/auth/permissions'
import {
  fillMonthSeries,
  isSnapshotTab,
  looksLikeId,
  snapshotWidgetErrorText,
  tenureLabel,
  widgetErr,
  widgetOk,
} from '@/server/services/company-snapshot.service'

describe('company snapshot wiring', () => {
  it('registers Snapshots under Reports paths and finance folder', () => {
    const app = LAUNCHER_APPS.find((row) => row.key === 'snapshots')
    expect(app?.href).toBe(COMPANY_SNAPSHOT_HREF)
    expect(app?.permission).toBe('report:overview')
    expect(MODULE_KEY_TO_FLAG.snapshots).toBe('reports')
    expect(moduleForPath(COMPANY_SNAPSHOT_HREF)).toBe('reports')
    expect(moduleForPath(COMPANY_SNAPSHOT_LEGACY_HREF)).toBe('reports')

    const finance = LAUNCHER_FOLDERS.find((folder) => folder.id === 'finance')
    expect(finance?.appKeys).toContain('snapshots')

    const reports = MODULES.find((row) => row.key === 'reports')
    expect(reports?.tabs?.some((tab) => tab.href === COMPANY_SNAPSHOT_HREF)).toBe(true)

    const analytics = MODULES.find((row) => row.key === 'analytics')
    expect(analytics?.owns).toEqual(['/analytics'])
    expect(analytics?.tabs?.some((tab) => tab.href === '/analytics')).toBe(true)
    expect(analytics?.tabs?.some((tab) => tab.href === COMPANY_SNAPSHOT_HREF)).toBe(false)
  })

  it('hides snapshot tiles from sellers and keeps them for accountants', () => {
    const sales = permissionsFor('SALES')
    const accountant = permissionsFor('ACCOUNTANT')
    expect(canViewBusinessOverview(sales)).toBe(false)
    expect(canViewBusinessOverview(accountant)).toBe(true)

    const salesHrefs = reportSectionsFor(sales).flatMap((s) => s.apps.map((a) => a.href))
    const acctHrefs = reportSectionsFor(accountant).flatMap((s) => s.apps.map((a) => a.href))
    expect(salesHrefs).not.toContain(COMPANY_SNAPSHOT_HREF)
    expect(salesHrefs).not.toContain(BUSINESS_OVERVIEW_HREF)
    expect(acctHrefs).toContain(COMPANY_SNAPSHOT_HREF)

    const rows = [
      { href: COMPANY_SNAPSHOT_HREF, label: 'Snapshot' },
      { href: `${COMPANY_SNAPSHOT_HREF}?tab=payments`, label: 'Payments' },
      { href: COMPANY_SNAPSHOT_LEGACY_HREF, label: 'Legacy' },
      { href: '/reports/profit-loss', label: 'P&L' },
    ]
    expect(withoutBusinessOverview(rows, sales).map((r) => r.href)).toEqual(['/reports/profit-loss'])
    expect(withoutBusinessOverview(rows, accountant)).toHaveLength(4)
  })
})

describe('company snapshot helpers', () => {
  it('accepts only known tabs', () => {
    expect(isSnapshotTab('company')).toBe(true)
    expect(isSnapshotTab('payments')).toBe(true)
    expect(isSnapshotTab('customer')).toBe(true)
    expect(isSnapshotTab('admin')).toBe(false)
    expect(isSnapshotTab(undefined)).toBe(false)
  })

  it('rejects forged customer ids', () => {
    expect(looksLikeId('clxyz0123456789abcdefgh')).toBe(true)
    expect(looksLikeId('../etc/passwd')).toBe(false)
    expect(looksLikeId("'; DROP TABLE customers;--")).toBe(false)
    expect(looksLikeId('')).toBe(false)
    expect(looksLikeId(null)).toBe(false)
  })

  it('never surfaces internal exception text in widget errors', () => {
    expect(snapshotWidgetErrorText(new Error('relation "secret" does not exist'))).not.toContain(
      'secret',
    )
    expect(widgetErr('This panel could not load. Try again in a moment.').ok).toBe(false)
    expect(widgetOk({ n: 1 }).ok).toBe(true)
  })

  it('formats customer tenure from createdAt', () => {
    expect(tenureLabel(new Date('2023-03-21T00:00:00.000Z'), '2026-11-21')).toBe(
      '3 Years, 8 Months',
    )
    expect(tenureLabel(new Date('2026-10-01T00:00:00.000Z'), '2026-11-21')).toBe('1 Month')
  })

  it('fills quiet months so sales history charts stay continuous', () => {
    const series = fillMonthSeries('2026-01-15', '2026-03-10', [
      { month: '2026-01', amount: '100.00' },
      { month: '2026-03', amount: '40.00' },
    ])
    expect(series).toHaveLength(3)
    expect(series.map((row) => row.amount)).toEqual(['100.00', '0.00', '40.00'])
    expect(series[1]?.name).toMatch(/Feb/)
  })
})
