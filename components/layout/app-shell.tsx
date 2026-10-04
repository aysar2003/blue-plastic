import { ROLE_LABELS } from '@/lib/roles'
import type { OrgContext } from '@/server/auth/context'
import { listBalanceAlerts } from '@/server/services/contact.service'
import * as inventoryService from '@/server/services/inventory.service'
import { MODULES } from './nav-items'
import { ShellChrome } from './shell-chrome'

/**
 * A Server Component. Permission filtering happens here, once, and the client
 * chrome receives only what this user may see — a hidden link is a convenience,
 * but the list it is hidden from is computed on the server.
 */
export async function AppShell({ ctx, children }: { ctx: OrgContext; children: React.ReactNode }) {
  const modules = MODULES.filter((entry) => !entry.permission || ctx.permissions.has(entry.permission))
  const moduleKeys = modules.map((entry) => entry.key)
  const permissions = [...ctx.permissions]
  const [alerts, stockAlerts] = await Promise.all([
    ctx.permissions.has('customer:read') ? listBalanceAlerts(ctx) : Promise.resolve([]),
    ctx.permissions.has('inventory:read') ? inventoryService.listStockAlerts(ctx) : Promise.resolve([]),
  ])

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
      alerts={alerts}
      stockAlerts={stockAlerts}
    >
      {children}
    </ShellChrome>
  )
}
