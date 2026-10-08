import { CompanyLetterhead } from '@/components/print/company-letterhead'
import { ReportTools } from '@/components/reports/report-tools'
import { requireOrgContext } from '@/server/auth/context'

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext('report:read')
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
