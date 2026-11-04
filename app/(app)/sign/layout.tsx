import { enforceModule } from '@/components/layout/module-gate'
import { requireOrgContext } from '@/server/auth/context'

export default async function SignLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext('knowledge:read')
  enforceModule(ctx, 'sign')
  return children
}
