import { enforceModule } from '@/components/layout/module-gate'
import { requireOrgContext } from '@/server/auth/context'

export default async function PlanningLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext('project:read')
  enforceModule(ctx, 'planning')
  return children
}
