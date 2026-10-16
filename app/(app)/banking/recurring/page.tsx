import type { Metadata } from 'next'
import Link from 'next/link'
import { RepeatIcon } from 'lucide-react'

import { BooksTabs } from '@/components/accounts/books-tabs'
import { CreateDueButton, RecurringRowActions } from '@/components/banking/recurring-actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/date'
import {
  RECURRING_FREQUENCY_LABELS,
  RECURRING_TYPE_LABELS,
} from '@/lib/validation/recurring'
import { requireOrgContext } from '@/server/auth/context'
import * as recurringService from '@/server/services/recurring.service'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Recurring transactions' }

function lastHref(kind: string | null, id: string | null) {
  if (!kind || !id) return null
  if (kind === 'journal') return `/journals/${id}`
  if (kind === 'expense') return `/purchases/expenses/${id}`
  return `/purchases/bills/${id}`
}

export default async function RecurringPage() {
  const ctx = await requireOrgContext()
  const rows = await recurringService.list(ctx)
  const canCreate =
    ctx.permissions.has('bill:create') || ctx.permissions.has('journal:post')
  const dueCount = rows.filter((row) => row.due).length

  return (
    <>
      <BooksTabs active="recurring" />
      <PageHeader
        title="Recurring transactions"
        description="Templates for bills, expenses, and journals that repeat on a schedule. Create due ones when you are ready — nothing posts on its own."
        actions={
          <div className="flex flex-wrap gap-2">
            {canCreate ? <CreateDueButton dueCount={dueCount} /> : null}
            {canCreate ? (
              <Link href="/banking/recurring/new" className={buttonVariants({ size: 'sm' })}>
                New template
              </Link>
            ) : null}
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={RepeatIcon}
          title="No recurring templates"
          description="Save a bill, expense, or journal that repeats — rent, subscriptions, depreciation."
          action={
            canCreate ? (
              <Link href="/banking/recurring/new" className={buttonVariants({ size: 'sm' })}>
                New template
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
                <TableHead>Type</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Next</TableHead>
                <TableHead>Last</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const href = lastHref(row.lastDocumentKind, row.lastDocumentId)
                const schedule =
                  row.interval === 1
                    ? RECURRING_FREQUENCY_LABELS[row.frequency]
                    : `Every ${row.interval} ${RECURRING_FREQUENCY_LABELS[row.frequency].toLowerCase()}`
                return (
                  <TableRow key={row.id} className={cn(row.due && 'bg-amber-50/60')}>
                    <TableCell className="font-medium">
                      <Link href={`/banking/recurring/${row.id}`} className="hover:underline">
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell>{RECURRING_TYPE_LABELS[row.type]}</TableCell>
                    <TableCell className="text-muted-foreground">{schedule}</TableCell>
                    <TableCell>
                      <span className={cn(row.due && 'font-medium text-amber-800')}>
                        {formatDate(row.nextRunOn)}
                        {row.due ? ' · due' : ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.lastRunOn ? (
                        href ? (
                          <Link href={href} className="hover:underline">
                            {formatDate(row.lastRunOn)}
                          </Link>
                        ) : (
                          formatDate(row.lastRunOn)
                        )
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{row.isActive ? 'Active' : 'Paused'}</TableCell>
                    <TableCell>
                      <RecurringRowActions
                        id={row.id}
                        name={row.name}
                        isActive={row.isActive}
                        due={row.due}
                        canAct={
                          row.type === 'JOURNAL'
                            ? ctx.permissions.has('journal:post')
                            : ctx.permissions.has('bill:create')
                        }
                      />
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
