import { Suspense } from 'react'

import { ROLE_LABELS } from '@/lib/roles'
import type { OrgContext } from '@/server/auth/context'
import { listBalanceAlerts } from '@/server/services/contact.service'
import * as inventoryService from '@/server/services/inventory.service'
import { BalanceAlerts } from './balance-alerts'
import { MODULES } from './nav-items'
import { ShellChrome } from './shell-chrome'
import { StockAlerts } from './stock-alerts'

/**
 * A Server Component. Permission filtering happens here, once, and the client
 * chrome receives only what this user may see — a hidden link is a convenience,
 * but the list it is hidden from is computed on the server.
 *
 * Stock and balance bells stream in via Suspense so page content is not blocked
 * on those queries; each loader is also short-cached per organisation.
 */
export async function AppShell({ ctx, children }: { ctx: OrgContext; children: React.ReactNode }) {
  const modules = MODULES.filter((entry) => !entry.permission || ctx.permissions.has(entry.permission))
  const moduleKeys = modules.map((entry) => entry.key)
  const permissions = [...ctx.permissions]

  return (
    <ShellChrome
      orgName={ctx.organization.name}
      organization={ctx.organization}
      baseCurrency={ctx.organization.baseCurrency}
      fiscalYearStartMonth={ctx.organization.fiscalYearStartMonth}
      roleLabel={ROLE_LABELS[ctx.role]}
      user={ctx.user}
      moduleKeys={moduleKeys}
      permissions={permissions}
      stockAlertsSlot={
        ctx.permissions.has('inventory:read') ? (
          <Suspense fallback={<StockAlerts alerts={[]} />}>
            <StockAlertsLoader ctx={ctx} />
          </Suspense>
        ) : null
      }
      balanceAlertsSlot={
        ctx.permissions.has('customer:read') ? (
          <Suspense fallback={<BalanceAlerts alerts={[]} />}>
            <BalanceAlertsLoader ctx={ctx} />
          </Suspense>
        ) : null
      }
    >
      {children}
    </ShellChrome>
  )
}

async function StockAlertsLoader({ ctx }: { ctx: OrgContext }) {
  const alerts = await inventoryService.listStockAlerts(ctx)
  return <StockAlerts alerts={alerts} />
}

async function BalanceAlertsLoader({ ctx }: { ctx: OrgContext }) {
  const alerts = await listBalanceAlerts(ctx)
  return <BalanceAlerts alerts={alerts} />
}
