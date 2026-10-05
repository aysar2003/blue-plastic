import { redirect } from 'next/navigation'

import { AppShell } from '@/components/layout/app-shell'
import { withDatabasePage } from '@/lib/page-guard'
import { getOrgContext } from '@/server/auth/context'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return withDatabasePage(async () => {
    const ctx = await getOrgContext()

    // No session, a revoked membership, or a token issued before a role change
    // (ADR-0007) all land here.
    if (!ctx) redirect('/sign-in')

    return <AppShell ctx={ctx}>{children}</AppShell>
  })
}
