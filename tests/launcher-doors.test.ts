import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { LAUNCHER_APPS } from '@/components/layout/launcher-apps'

/** Map each home-app front door to the route file that must exist. */
const DOOR_PAGE: Record<string, string> = {
  pos: 'app/(app)/pos/page.tsx',
  sales: 'app/(app)/sales/page.tsx',
  customers: 'app/(app)/customers/page.tsx',
  purchases: 'app/(app)/purchases/page.tsx',
  vendors: 'app/(app)/vendors/page.tsx',
  banking: 'app/(app)/banking/page.tsx',
  payments: 'app/(app)/payments/page.tsx',
  inventory: 'app/(app)/inventory/page.tsx',
  barcodes: 'app/(app)/barcodes/page.tsx',
  stores: 'app/(app)/stores/page.tsx',
  accounting: 'app/(app)/accounting/page.tsx',
  journals: 'app/(app)/journals/page.tsx',
  reports: 'app/(app)/reports/page.tsx',
  'bill-payments': 'app/(app)/bill-payments/page.tsx',
  periods: 'app/(app)/periods/page.tsx',
  calendar: 'app/(app)/calendar/page.tsx',
  databases: 'app/(app)/databases/page.tsx',
  settings: 'app/(app)/settings/page.tsx',
  help: 'app/(app)/help/page.tsx',
}

describe('launcher front doors', () => {
  it('lists every expected home app once', () => {
    expect(LAUNCHER_APPS.map((app) => app.key).sort()).toEqual(Object.keys(DOOR_PAGE).sort())
  })

  it('points each app at its own hub — not a nested expense/invoice deep link', () => {
    const expected: Record<string, string> = {
      pos: '/pos',
      sales: '/sales',
      customers: '/customers',
      purchases: '/purchases',
      vendors: '/vendors',
      banking: '/banking',
      payments: '/payments',
      inventory: '/inventory',
      barcodes: '/barcodes',
      stores: '/stores',
      accounting: '/accounting',
      journals: '/journals',
      reports: '/reports',
      'bill-payments': '/bill-payments',
      periods: '/periods',
      calendar: '/calendar',
      databases: '/databases',
      settings: '/settings',
      help: '/help',
    }
    for (const app of LAUNCHER_APPS) {
      expect(app.href, app.key).toBe(expected[app.key])
      expect(app.href.includes('/expenses'), app.key).toBe(false)
    }
  })

  it('has a real page for every door', () => {
    const root = path.resolve(__dirname, '..')
    for (const app of LAUNCHER_APPS) {
      const rel = DOOR_PAGE[app.key]
      expect(rel, app.key).toBeTruthy()
      expect(existsSync(path.join(root, rel)), `${app.key} → ${rel}`).toBe(true)
    }
  })
})
