import { PosShell } from '@/components/pos/pos-shell'
import { requireOrgContext } from '@/server/auth/context'

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext('pos:read')
  return (
    <PosShell orgName={ctx.organization.name} permissions={[...ctx.permissions]}>
      {children}
    </PosShell>
  )
}
