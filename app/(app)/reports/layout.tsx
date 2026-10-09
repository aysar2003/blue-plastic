import { CompanyLetterhead } from '@/components/print/company-letterhead'
import { ReportTools } from '@/components/reports/report-tools'
import { requireOrgContext } from '@/server/auth/context'
import { forbidden } from '@/server/errors'

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext()
  // Each report page checks `report:read`. The business overview checks
  // `report:overview` on its own, so that capability can open its route
  // without unlocking the rest of the catalogue.
  if (!ctx.permissions.has('report:read') && !ctx.permissions.has('report:overview')) {
    throw forbidden('This action requires the "report:read" permission.')
  }
  // The report tabs are rendered by the shell, which carries the current period
  // across them. See components/layout/module-tabs.tsx.
  return (
    <div data-report-root data-template="standard">
      <CompanyLetterhead organization={ctx.organization} className="report-letterhead mb-4" />
      <ReportTools />
      {children}
    </div>
  )
}
