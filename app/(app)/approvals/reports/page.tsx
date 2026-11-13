import type { Metadata } from 'next'

import { APPROVAL_REPORT_APPS } from '@/components/layout/module-hubs'
import { ModuleReportList } from '@/components/reports/module-report-list'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Approval reports' }

export default async function ApprovalReportsHubPage() {
  await requireOrgContext('report:read')

  return (
    <ModuleReportList
      eyebrow="Approvals"
      title="Approval reports"
      subtitle="What is waiting on a checker, and what was already decided."
      apps={APPROVAL_REPORT_APPS}
    />
  )
}
