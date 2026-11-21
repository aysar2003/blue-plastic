import type { Metadata } from 'next'
import { FileTextIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { SearchInput } from '@/components/data/search-input'
import { PortalInvoicesTable } from '@/components/portal/portal-invoices-table'
import { parseListQuery } from '@/lib/validation/common'
import { requirePortalContext } from '@/server/auth/context'
import * as portalService from '@/server/services/portal.service'

export const metadata: Metadata = { title: 'Invoices' }

export default async function PortalInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requirePortalContext()
  const params = await searchParams
  const query = parseListQuery(params)
  const [page, upcoming] = await Promise.all([
    portalService.listInvoices(ctx, query),
    portalService.listUpcomingSubscriptions(ctx),
  ])
  const currency = ctx.organization.baseCurrency

  return (
    <div className="space-y-4">
      <PageHeader
        title="Invoices"
        description="Open any invoice to view it. Sort, drag columns, or Customize which columns show."
      />
      <SearchInput placeholder="Search by number or reference" />

      {upcoming.length > 0 ? (
        <div className="rounded-md border p-3 text-sm">
          <p className="mb-1 font-medium">Upcoming invoices</p>
          <ul className="space-y-1 text-muted-foreground">
            {upcoming.map((row) => (
              <li key={row.id}>
                {row.name} · {row.nextRunOn}
                {row.amount ? ` · ${row.amount}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {page.total === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title={query.q ? 'No invoices match' : 'No invoices yet'}
          description={
            query.q ? 'Try a different search.' : 'When invoices are issued, they will appear here.'
          }
        />
      ) : (
        <PortalInvoicesTable rows={page.rows} currency={currency} />
      )}
    </div>
  )
}
