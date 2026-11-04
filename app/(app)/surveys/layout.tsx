import { enforceModule } from '@/components/layout/module-gate'
import { requireOrgContext } from '@/server/auth/context'

export default async function SurveysLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext('knowledge:read')
  enforceModule(ctx, 'surveys')
  return children
}
