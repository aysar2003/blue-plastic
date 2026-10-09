import { Suspense } from 'react'

import { BalanceAlerts } from '@/components/layout/balance-alerts'
import { StockAlerts } from '@/components/layout/stock-alerts'
import type { OrgContext } from '@/server/auth/context'
import { listBalanceAlerts } from '@/server/services/contact.service'
import * as inventoryService from '@/server/services/inventory.service'

export function stockAlertsSlot(ctx: OrgContext) {
  if (!ctx.permissions.has('inventory:read')) return null
  return (
    <Suspense fallback={<StockAlerts alerts={[]} total={0} />}>
      <StockAlertsLoader ctx={ctx} />
    </Suspense>
  )
}

export function balanceAlertsSlot(ctx: OrgContext) {
  if (!ctx.permissions.has('customer:read')) return null
  return (
    <Suspense fallback={<BalanceAlerts alerts={[]} />}>
      <BalanceAlertsLoader ctx={ctx} />
    </Suspense>
  )
}

async function StockAlertsLoader({ ctx }: { ctx: OrgContext }) {
  const { alerts, total } = await inventoryService.listStockAlerts(ctx)
  return <StockAlerts alerts={alerts} total={total} />
}

async function BalanceAlertsLoader({ ctx }: { ctx: OrgContext }) {
  const alerts = await listBalanceAlerts(ctx)
  return <BalanceAlerts alerts={alerts} />
}
