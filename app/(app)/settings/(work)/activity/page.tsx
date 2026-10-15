import type { Metadata } from 'next'

import { QueryProvider } from '@/components/providers/query-provider'
import { requireOrgContext } from '@/server/auth/context'
import { ActivityList } from './activity-list'

export const metadata: Metadata = { title: 'Trash' }

export default async function ActivityPage() {
  const ctx = await requireOrgContext('audit:read')
  const canClear = ctx.permissions.has('org:update')

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every deleted transaction — invoices, sales papers, bills, expenses, payments, transfers,
        journals, and more. Open a row to view the PDF, restore it to the books, or upload supporting
        files. Clear Trash empties this list; soft-deleted entries stay out of the company books.
      </p>
      <QueryProvider>
        <ActivityList timeZone={ctx.organization.timeZone} canClear={canClear} />
      </QueryProvider>
    </div>
  )
}
