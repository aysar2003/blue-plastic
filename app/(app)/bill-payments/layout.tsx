import { enforceModule } from '@/components/layout/module-gate'
import { requireOrgContext } from '@/server/auth/context'

export default async function BillPaymentsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext()
  enforceModule(ctx, 'bill-payments')
  return children
}
