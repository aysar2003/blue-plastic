import type { Metadata } from 'next'

import { QueryProvider } from '@/components/providers/query-provider'
import { requireOrgContext } from '@/server/auth/context'
import { ActivityList } from './activity-list'

export const metadata: Metadata = { title: 'Trash' }

export default async function ActivityPage() {
  const ctx = await requireOrgContext('audit:read')

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every deleted transaction — invoices, sales papers, bills, expenses, payments, transfers, and
        more. Download the PDF, then open the row to upload scans or supporting files. Nothing here
        goes back into the company books.
      </p>
      <QueryProvider>
        <ActivityList timeZone={ctx.organization.timeZone} />
      </QueryProvider>
    </div>
  )
}
