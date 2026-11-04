import { enforceModule } from '@/components/layout/module-gate'
import { requireOrgContext } from '@/server/auth/context'

export default async function AppointmentsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext('calendar:read')
  enforceModule(ctx, 'appointments')
  return children
}
