import type { Metadata } from 'next'
import { BanknoteIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { SearchInput } from '@/components/data/search-input'
import { PortalPaymentsTable } from '@/components/portal/portal-payments-table'
import { parseListQuery } from '@/lib/validation/common'
import { requirePortalContext } from '@/server/auth/context'
import * as portalService from '@/server/services/portal.service'

export const metadata: Metadata = { title: 'Payments' }

export default async function PortalPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requirePortalContext()
  const params = await searchParams
  const query = parseListQuery(params)
  const page = await portalService.listPayments(ctx, query)
  const currency = ctx.organization.baseCurrency

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payments"
        description="Money recorded against your account, and the invoices it settled. Sort, drag columns, or Customize which columns show."
      />
      <SearchInput placeholder="Search by number or reference" />

      {page.total === 0 ? (
        <EmptyState
          icon={BanknoteIcon}
          title={query.q ? 'No payments match' : 'No payments yet'}
          description={
            query.q ? 'Try a different search.' : 'Payments applied to your invoices will show here.'
          }
        />
      ) : (
        <PortalPaymentsTable rows={page.rows} currency={currency} />
      )}
    </div>
  )
}
