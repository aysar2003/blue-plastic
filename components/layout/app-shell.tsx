import { ROLE_LABELS } from '@/lib/roles'
import type { OrgContext } from '@/server/auth/context'
import { MODULES } from './nav-items'
import { ShellChrome } from './shell-chrome'

/**
 * A Server Component. Permission filtering happens here, once, and the client
 * chrome receives only what this user may see — a hidden link is a convenience,
 * but the list it is hidden from is computed on the server.
 */
export function AppShell({ ctx, children }: { ctx: OrgContext; children: React.ReactNode }) {
  const modules = MODULES.filter((entry) => !entry.permission || ctx.permissions.has(entry.permission))
  const moduleKeys = modules.map((entry) => entry.key)
  const permissions = [...ctx.permissions]

  return (
    <ShellChrome
      orgName={ctx.organization.name}
      baseCurrency={ctx.organization.baseCurrency}
      fiscalYearStartMonth={ctx.organization.fiscalYearStartMonth}
      roleLabel={ROLE_LABELS[ctx.role]}
      user={ctx.user}
      moduleKeys={moduleKeys}
      permissions={permissions}
    >
      {children}
    </ShellChrome>
  )
}
