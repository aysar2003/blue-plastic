import { enforceModule } from '@/components/layout/module-gate'
import { requireOrgContext } from '@/server/auth/context'

export default async function InsuranceLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext()
  enforceModule(ctx, 'banking')
  return children
}
