import type { Metadata } from 'next'
import Link from 'next/link'
import { UsersIcon } from 'lucide-react'

import { InvitePortalUserDialog } from '@/components/customers/invite-portal-user-dialog'
import { PortalUserActions } from '@/components/customers/portal-user-actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Pagination } from '@/components/data/pagination'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { SearchInput } from '@/components/data/search-input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/date'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import * as contactService from '@/server/services/contact.service'
import * as portalService from '@/server/services/portal.service'

export const metadata: Metadata = { title: 'Portal users' }

export default async function PortalUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('customer:read')
  if (!ctx.features.enableCustomerPortal) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Portal users"
          description="The customer portal is off for this company."
        />
        <p className="text-sm text-muted-foreground">
          Turn it on under{' '}
          <Link href="/settings/features" className="font-medium text-primary underline">
            Settings → Apps & features
          </Link>
          , then invite customers from this page or the customer form.
        </p>
      </div>
    )
  }
  const params = await searchParams
  const query = parseListQuery(params)
  const customerId = typeof params.customerId === 'string' ? params.customerId : undefined
  const canManage = ctx.permissions.has('portal:manage')

  const [page, customersPage] = await Promise.all([
    portalService.listPortalUsers(ctx, query, customerId),
    canManage
      ? contactService.listCustomers(ctx, { page: 1, pageSize: 5000, dir: 'asc' })
      : Promise.resolve({ rows: [] as { id: string; displayName: string; companyName: string | null }[], total: 0 }),
  ])

  const customers = customersPage.rows.map((row) => {
    const company =
      row.companyName && row.companyName.trim() && row.companyName.trim() !== row.displayName.trim()
        ? row.companyName.trim()
        : null
    return {
      id: row.id,
      // Full display name on its own line — never packed into "Name (Company)"
      // where long Somali names get clipped in the narrow invite dialog.
      label: row.displayName,
      ...(company ? { hint: company } : {}),
    }
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Portal users"
        description="Customer logins for the self-service portal. Separate from staff users in Settings."
        actions={
          canManage ? (
            <InvitePortalUserDialog customers={customers} defaultCustomerId={customerId} />
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search by name, email, or customer" />
        {customerId ? (
          <Badge variant="secondary">
            Filtered customer{' '}
            <Link href="/customers/portal-users" className="ml-1 underline">
              Clear
            </Link>
          </Badge>
        ) : null}
      </div>

      {page.total === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={query.q || customerId ? 'No portal users match' : 'No portal users yet'}
          description={
            query.q || customerId
              ? 'Try a different search, or clear the customer filter.'
              : 'Invite a customer so they can see their balance, invoices, and statement.'
          }
          action={
            canManage && !query.q ? (
              <InvitePortalUserDialog customers={customers} defaultCustomerId={customerId} />
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ScrollSheet>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-sm text-muted-foreground">{row.email}</div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/customers?id=${encodeURIComponent(row.customerId)}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.customerName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === 'ACTIVE'
                            ? 'default'
                            : row.status === 'INVITED'
                              ? 'warning'
                              : 'secondary'
                        }
                      >
                        {row.status === 'ACTIVE'
                          ? 'Active'
                          : row.status === 'INVITED'
                            ? 'Invite pending'
                            : 'Suspended'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.lastLoginAt
                        ? formatDateTime(row.lastLoginAt, ctx.organization.timeZone)
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      {canManage && row.membershipId ? (
                        <PortalUserActions
                          membershipId={row.membershipId}
                          status={row.status}
                          email={row.email}
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollSheet>
          <Pagination total={page.total} page={page.page} pageSize={page.pageSize} />
        </Card>
      )}
    </div>
  )
}
