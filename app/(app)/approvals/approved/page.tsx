import type { Metadata } from 'next'
import { ClipboardCheckIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { FilterChips } from '@/components/data/filter-chips'
import { PageHeader } from '@/components/data/page-header'
import { Pagination } from '@/components/data/pagination'
import { SearchInput } from '@/components/data/search-input'
import { TableToolbar } from '@/components/data/table-toolbar'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import * as approvalService from '@/server/services/approval.service'
import { trailsFor } from '@/server/services/audit.service'
import type { ApprovalRequestStatus } from '@prisma/client'

import { ApprovalRequestTable } from '../request-table'
import { toApprovalRow, withCreatedBy } from '../to-row'

export const metadata: Metadata = { title: 'All approved' }

const STATUS_CHIPS = [
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'Approved & rejected' },
]

export default async function ApprovalsApprovedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('org:read')
  const search = await searchParams
  const query = parseListQuery(search)
  const rawStatus = Array.isArray(search.status) ? search.status[0] : search.status
  const status: ApprovalRequestStatus | 'ALL' =
    rawStatus === 'REJECTED' || rawStatus === 'ALL' ? rawStatus : 'APPROVED'

  if (!approvalService.approvalsEnabled(ctx)) {
    return (
      <>
        <PageHeader title="All approved" description="Turn on approvals to keep a history here." />
      </>
    )
  }

  const page = await approvalService.listDecided(ctx, query, status)
  const trails = await trailsFor(ctx, page.rows.map((row) => row.entityId))
  const rows = withCreatedBy(
    page.rows.map((row) => toApprovalRow(ctx, row)),
    trails,
  )
  const linkParams = { q: query.q, status: status === 'APPROVED' ? undefined : status }

  return (
    <>
      <PageHeader
        title="All approved"
        description="Every document a checker posted or sent back. Print this list, or open View / Edit / Print on one row."
        actions={<TableToolbar />}
      />

      <div className="mb-3">
        <FilterChips
          options={STATUS_CHIPS}
          active={status}
          path="/approvals/approved"
          param="status"
          params={linkParams}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search document or person" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheckIcon}
          title={query.q || status !== 'APPROVED' ? 'Nothing matches that filter' : 'No approvals yet'}
          description={
            query.q || status !== 'APPROVED'
              ? 'Try a different status or search.'
              : 'Approved papers will list here after a checker posts them.'
          }
        />
      ) : (
        <>
          <ApprovalRequestTable
            rows={rows}
            timeZone={ctx.organization.timeZone}
            baseCurrency={ctx.organization.baseCurrency}
            mode="history"
          />
          <Pagination total={page.total} />
        </>
      )}
    </>
  )
}
