import type { Metadata } from 'next'
import { FolderKanbanIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { SearchInput } from '@/components/data/search-input'
import { PortalProjectsTable } from '@/components/portal/portal-projects-table'
import { parseListQuery } from '@/lib/validation/common'
import { requirePortalContext } from '@/server/auth/context'
import * as portalService from '@/server/services/portal.service'

export const metadata: Metadata = { title: 'Projects' }

export default async function PortalProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requirePortalContext()
  const params = await searchParams
  const query = parseListQuery(params)
  const page = await portalService.listProjectsForCustomer(ctx, query)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Projects"
        description="Jobs on this account. Status and dates only — sales stay on Invoices and Quotes."
      />
      <SearchInput placeholder="Search by number, name, or site" />

      {page.total === 0 ? (
        <EmptyState
          icon={FolderKanbanIcon}
          title={query.q ? 'No projects match' : 'No projects yet'}
          description={
            query.q
              ? 'Try a different search.'
              : 'When the company opens a job on this account, it will appear here.'
          }
        />
      ) : (
        <PortalProjectsTable rows={page.rows} currency={ctx.organization.baseCurrency} />
      )}
    </div>
  )
}
