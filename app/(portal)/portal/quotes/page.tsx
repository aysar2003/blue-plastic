import type { Metadata } from 'next'
import { FileTextIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { SearchInput } from '@/components/data/search-input'
import { PortalQuotesTable } from '@/components/portal/portal-quotes-table'
import { parseListQuery } from '@/lib/validation/common'
import { requirePortalContext } from '@/server/auth/context'
import * as portalService from '@/server/services/portal.service'

export const metadata: Metadata = { title: 'Quotes' }

export default async function PortalQuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requirePortalContext()
  const params = await searchParams
  const query = parseListQuery(params)
  const page = await portalService.listQuotes(ctx, query)
  const currency = ctx.organization.baseCurrency

  return (
    <div className="space-y-4">
      <PageHeader
        title="Quotes"
        description="Estimates and quotations sent to this account. Open one to print or download a PDF."
      />
      <SearchInput placeholder="Search by number or reference" />

      {page.total === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title={query.q ? 'No quotes match' : 'No quotes yet'}
          description={
            query.q
              ? 'Try a different search.'
              : 'When the company sends an estimate or quotation, it will appear here.'
          }
        />
      ) : (
        <PortalQuotesTable rows={page.rows} currency={currency} />
      )}
    </div>
  )
}
