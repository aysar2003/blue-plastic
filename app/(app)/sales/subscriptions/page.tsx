import type { Metadata } from 'next'
import Link from 'next/link'
import { RepeatIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { SubscriptionRowActions, CreateDueSubscriptionsButton } from '@/components/sales/subscription-actions'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import {
  RECURRING_FREQUENCY_LABELS,
} from '@/lib/validation/recurring'
import { requireOrgContext } from '@/server/auth/context'
import * as deferredRevenue from '@/server/services/deferred-revenue.service'
import * as recurringService from '@/server/services/recurring.service'

export const metadata: Metadata = { title: 'Subscriptions' }

export default async function SalesSubscriptionsPage() {
  const ctx = await requireOrgContext('invoice:read')
  const canCreate = ctx.permissions.has('invoice:create')

  let autoCreated = 0
  if (canCreate) {
    const auto = await recurringService.createDue(ctx)
    autoCreated = auto.created.filter((row) => row.documentKind === 'invoice').length
  }

  const [rows, openDefer] = await Promise.all([
    recurringService.list(ctx, { types: ['INVOICE'] }),
    deferredRevenue.listOpenSchedules(ctx),
  ])
  const dueCount = rows.filter((row) => row.due).length
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="Subscriptions & recurring invoices"
        description={
          autoCreated > 0
            ? `Created ${autoCreated} due invoice${autoCreated === 1 ? '' : 's'} when you opened this page.`
            : 'Bill schedules for SaaS, memberships, and rentals. Optional deferred revenue recognizes monthly into income.'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canCreate ? <CreateDueSubscriptionsButton dueCount={dueCount} /> : null}
            {canCreate ? (
              <Link href="/sales/subscriptions/new" className={buttonVariants({ size: 'sm' })}>
                New schedule
              </Link>
            ) : null}
          </div>
        }
      />

      {openDefer.length > 0 ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Open deferred revenue</CardTitle>
            <CardDescription>
              Unearned balances waiting to recognize. Create due also runs recognition.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Next recognize</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openDefer.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/sales/invoices/${row.salesDocumentId}`}
                        className="hover:underline"
                      >
                        Open invoice
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatMoney(row.remaining, currency)}
                    </TableCell>
                    <TableCell>{formatDate(row.nextRecognizeOn)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={RepeatIcon}
          title="No subscription schedules"
          description="Save a recurring invoice for rent, membership, or SaaS billing."
          action={
            canCreate ? (
              <Link href="/sales/subscriptions/new" className={buttonVariants({ size: 'sm' })}>
                New schedule
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Next</TableHead>
                <TableHead>Last</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const schedule =
                  row.interval === 1
                    ? RECURRING_FREQUENCY_LABELS[row.frequency]
                    : `Every ${row.interval} · ${RECURRING_FREQUENCY_LABELS[row.frequency]}`
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/sales/subscriptions/${row.id}`}
                        className="font-medium hover:underline"
                      >
                        {row.name}
                      </Link>
                      {row.due ? (
                        <span className="ml-2 text-xs text-warning">Due</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{schedule}</TableCell>
                    <TableCell>{formatDate(row.nextRunOn)}</TableCell>
                    <TableCell>
                      {row.lastDocumentId ? (
                        <Link
                          href={`/sales/invoices/${row.lastDocumentId}`}
                          className="hover:underline"
                        >
                          {row.lastRunOn ? formatDate(row.lastRunOn) : 'Invoice'}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{row.isActive ? 'Active' : 'Paused'}</TableCell>
                    <TableCell className="text-right">
                      {canCreate ? <SubscriptionRowActions id={row.id} isActive={row.isActive} /> : null}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  )
}
