import { redirect } from 'next/navigation'

import { PortalShell } from '@/components/portal/portal-shell'
import { portalLoginPath } from '@/lib/portal-login'
import { withDatabasePage } from '@/lib/page-guard'
import { getOrgContext } from '@/server/auth/context'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  return withDatabasePage(async () => {
    const ctx = await getOrgContext()
    if (!ctx) redirect('/login/portal')
    if (ctx.role !== 'CUSTOMER') redirect('/dashboard')
    // Use ?error=… so portal login does not bounce a stuck CUSTOMER session
    // back here (login → /portal → login forever → “Rendering…”).
    if (!ctx.portalCustomerId) {
      redirect(`${portalLoginPath(ctx.orgId)}&error=unavailable`)
    }
    if (!ctx.features.enableCustomerPortal) {
      redirect(`${portalLoginPath(ctx.orgId)}&error=disabled`)
    }

    return (
      <PortalShell
        companyName={ctx.organization.name}
        orgId={ctx.orgId}
        userName={ctx.user.name}
      >
        {children}
      </PortalShell>
    )
  })
}
