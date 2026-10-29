import { enforceModule } from '@/components/layout/module-gate'
import { requireOrgContext } from '@/server/auth/context'
import { EmployeesSubnav } from './employees-subnav'

export default async function EmployeesLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext()
  enforceModule(ctx, 'employees')
  return (
    <>
      <EmployeesSubnav permissions={[...ctx.permissions]} />
      {children}
    </>
  )
}
