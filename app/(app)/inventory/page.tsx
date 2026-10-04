import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { INVENTORY_HUB_APPS, visibleHubApps } from '@/components/layout/module-hubs'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as inventoryService from '@/server/services/inventory.service'

export const metadata: Metadata = { title: 'Inventory' }

export default async function InventoryHubPage() {
  const ctx = await requireOrgContext('item:read')
  const apps = visibleHubApps(INVENTORY_HUB_APPS, ctx.permissions)
  const currency = ctx.organization.baseCurrency
  const canStock = ctx.permissions.has('inventory:read')

  const [itemCount, stock] = await Promise.all([
    db.item.count({ where: { orgId: ctx.orgId, isActive: true } }),
    canStock ? inventoryService.stockOnHand(ctx) : Promise.resolve(null),
  ])

  const low = stock?.items.filter((item) => item.belowReorder).length ?? 0

  return (
    <AppLauncher
      eyebrow={ctx.organization.name}
      title="Inventory"
      subtitle="Products, what is on the shelf, and the counts that disagree."
      apps={apps}
      insights={
        stock
          ? [
              {
                label: 'On hand',
                value: formatMoney(stock.totalValue, currency),
                hint: 'at average cost',
                href: '/inventory/stock',
              },
              {
                label: 'Products',
                value: String(itemCount),
                hint: 'active',
                href: '/items',
              },
              {
                label: 'To reorder',
                value: String(low),
                hint: low === 1 ? 'at or below its point' : 'at or below their point',
                href: '/reports/inventory-reorder',
              },
            ]
          : undefined
      }
    />
  )
}
