import { enforceModule } from '@/components/layout/module-gate'
import { requireOrgContext } from '@/server/auth/context'
import { forbidden } from '@/server/errors'

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext()
  enforceModule(ctx, 'reports')
  if (!ctx.permissions.has('report:overview')) {
    throw forbidden('This action requires the "report:overview" permission.')
  }
  return children
}
