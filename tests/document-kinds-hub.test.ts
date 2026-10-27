import { describe, expect, it } from 'vitest'

import { salesAppsForPermissions } from '@/components/layout/sales-apps'
import { PURCHASE_HUB_APPS, visibleHubApps } from '@/components/layout/module-hubs'
import { DEFAULT_FEATURE_FLAGS, parseFeatureFlags } from '@/lib/feature-flags'

describe('document kinds hide hub tiles', () => {
  const allPermissions = new Set([
    'invoice:read',
    'invoice:create',
    'payment:create',
    'customer:read',
    'report:read',
    'bill:read',
    'expense:create',
    'vendor:read',
    'item:read',
    'inventory:read',
    'inventory:adjust',
  ])

  it('hides disabled sales document types from the sales hub', () => {
    const flags = parseFeatureFlags({
      documentKinds: { sales: { ESTIMATE: false, QUOTATION: false } },
    })
    const apps = salesAppsForPermissions(allPermissions, flags)
    const keys = apps.map((app) => app.key)
    expect(keys).not.toContain('estimates')
    expect(keys).not.toContain('quotations')
    expect(keys).toContain('invoices')
  })

  it('hides disabled purchase document types from the purchases hub', () => {
    const flags = parseFeatureFlags({
      documentKinds: { purchases: { BILL: false, EXPENSE: true } },
    })
    const apps = visibleHubApps(PURCHASE_HUB_APPS, allPermissions, flags, 'purchases')
    const keys = apps.map((app) => app.key)
    expect(keys).not.toContain('bills')
    expect(keys).toContain('expenses')
  })

  it('keeps every tile when document kinds are at defaults', () => {
    const apps = salesAppsForPermissions(allPermissions, DEFAULT_FEATURE_FLAGS)
    expect(apps.some((app) => app.key === 'estimates')).toBe(true)
    expect(apps.some((app) => app.key === 'invoices')).toBe(true)

    const purchaseApps = visibleHubApps(
      PURCHASE_HUB_APPS,
      allPermissions,
      DEFAULT_FEATURE_FLAGS,
      'purchases',
    )
    expect(purchaseApps.some((app) => app.key === 'purchase-requests')).toBe(true)
    expect(purchaseApps.some((app) => app.key === 'rfqs')).toBe(true)
  })
})
