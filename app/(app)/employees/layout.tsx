import { enforceModule } from '@/components/layout/module-gate'
import { requireOrgContext } from '@/server/auth/context'
import { linkedEmployeeId } from '@/server/services/payroll-standard.service'
import { EmployeesSubnav } from './employees-subnav'

export default async function EmployeesLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext()
  enforceModule(ctx, 'employees')
  const linkedId = await linkedEmployeeId(ctx)
  return (
    <>
      <EmployeesSubnav permissions={[...ctx.permissions]} showMine={Boolean(linkedId)} />
      {children}
    </>
  )
}
