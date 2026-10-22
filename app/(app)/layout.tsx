import { redirect } from 'next/navigation'

import { AppShell } from '@/components/layout/app-shell'
import { withDatabasePage } from '@/lib/page-guard'
import { getOrgContext } from '@/server/auth/context'
import { listUserDatabases } from '@/server/services/backup-import.service'
import { canViewGroupReports } from '@/server/services/company-group.service'
import { balanceAlertsSlot, calendarAlertsSlot, stockAlertsSlot } from './shell-alerts'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return withDatabasePage(async () => {
    const ctx = await getOrgContext()

    // No session, a revoked membership, or a token issued before a role change
    // (ADR-0007) all land here.
    if (!ctx) redirect('/login/company')
    // Portal logins never enter the ERP shell.
    if (ctx.role === 'CUSTOMER') redirect('/portal')

    const canSwitch = ctx.isSystemOwner || ctx.canConnect
    const [showCompanyReports, databases] = await Promise.all([
      canViewGroupReports(ctx),
      canSwitch ? listUserDatabases(ctx) : Promise.resolve([]),
    ])

    // Month P&L chart lives on /reports only (see reports/page.tsx). Loading it
    // from this layout re-ran a full ledger scan on every signed-in navigation.
    return (
      <AppShell
        ctx={ctx}
        stockAlertsSlot={stockAlertsSlot(ctx)}
        balanceAlertsSlot={balanceAlertsSlot(ctx)}
        calendarAlertsSlot={calendarAlertsSlot(ctx)}
        showCompanyReports={showCompanyReports}
        databases={databases}
      >
        {children}
      </AppShell>
    )
  })
}
