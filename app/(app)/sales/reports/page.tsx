import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { SALES_REPORT_APPS } from '@/components/layout/sales-apps'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Sales reports' }

/**
 * The sales slice of the report catalogue — same destinations as the main
 * Reports index, reached without walking past every other module's questions.
 */
export default async function SalesReportsHubPage() {
  await requireOrgContext('report:read')

  return (
    <AppLauncher
      eyebrow="Sales"
      title="Sales reports"
      subtitle="Who buys, what sells, and who still owes."
      apps={SALES_REPORT_APPS}
      searchable
    />
  )
}
