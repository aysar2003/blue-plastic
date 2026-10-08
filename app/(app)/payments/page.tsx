import type { Metadata } from 'next'
import Link from 'next/link'
import { BanknoteIcon, PlusIcon } from 'lucide-react'

import { ClickableRow } from '@/components/data/clickable-row'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Pagination } from '@/components/data/pagination'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { SearchInput } from '@/components/data/search-input'
import { TableToolbar } from '@/components/data/table-toolbar'
import { readSort, SortableHeader } from '@/components/data/sortable-header'
import { FilterChips } from '@/components/data/filter-chips'
import { EnteredByToggle } from '@/components/data/entered-by-toggle'
import { EnteredByCell, EnteredByHead } from '@/components/data/recorded-by'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RowActions } from '@/components/data/row-actions'
import { formatDate, toCalendarDate, today } from '@/lib/date'
import { DATE_PRESETS, presetRange, readDatePreset } from '@/lib/list-filters'
import { formatMoney } from '@/lib/money'
import { PAYMENT_METHOD_LABELS, STATUS_LABELS, STATUS_VARIANTS } from '@/lib/sales-types'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import { trailsFor } from '@/server/services/audit.service'
import * as paymentService from '@/server/services/payment.service'

const SORTABLE = ['number', 'date', 'customer', 'method', 'amount'] as const

export const metadata: Metadata = { title: 'Payments' }

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('payment:read')
  const search = await searchParams
  const query = parseListQuery(search)
  const sort = readSort(search, SORTABLE, { sort: 'date', dir: 'desc' })
  const datePreset = readDatePreset(search.date)
  const range = presetRange(datePreset, today(ctx.organization.timeZone))
  const linkParams = { q: query.q, sort: sort.sort, dir: sort.dir, date: datePreset || undefined }
  const page = await paymentService.list(ctx, query, { ...sort, from: range?.from, to: range?.to })
  const trails = await trailsFor(ctx, page.rows.map((payment) => payment.id))
  const currency = ctx.organization.baseCurrency
  const canVoid = ctx.permissions.has('payment:void')
  const canEdit = ctx.permissions.has('payment:update')
  const canReport = ctx.permissions.has('report:read')

  const newButton = ctx.permissions.has('payment:create') ? (
    <Link href="/payments/new" className={buttonVariants({ size: 'sm' })}>
      <PlusIcon /> Receive payment
    </Link>
  ) : undefined

  return (
    <>
      <PageHeader
        title="Payments received"
        description="Each payment is its own document. It may settle several invoices, part of one, or none at all — unapplied money stays as a customer credit."
        actions={newButton}
      />

      <div className="mb-3">
        <FilterChips options={[...DATE_PRESETS]} active={datePreset} path="/payments" param="date" params={linkParams} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search number, reference or customer" />
        <EnteredByToggle />
        <div className="ml-auto">
          <TableToolbar exportHref={`/api/exports/payments?${new URLSearchParams(
            Object.entries(linkParams).filter((entry): entry is [string, string] => Boolean(entry[1])),
          ).toString()}`} />
        </div>
      </div>

      {page.total === 0 ? (
        <EmptyState
          icon={BanknoteIcon}
          title={query.q || datePreset ? 'No payments match that filter' : 'No payments recorded yet'}
          description={query.q || datePreset ? 'Try a different date or search.' : 'Record money received from a customer.'}
          action={!query.q && !datePreset ? newButton : undefined}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ScrollSheet>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="number" label="Number" state={sort} basePath="/payments" params={linkParams} className="w-32" />
                <SortableHeader column="date" label="Date" state={sort} basePath="/payments" params={linkParams} className="w-28" defaultDirection="desc" />
                <SortableHeader column="customer" label="Customer" state={sort} basePath="/payments" params={linkParams} />
                <SortableHeader column="method" label="Method" state={sort} basePath="/payments" params={linkParams} />
                <TableHead>Into</TableHead>
                <SortableHeader column="amount" label="Amount" state={sort} basePath="/payments" params={linkParams} className="w-28" numeric defaultDirection="desc" />
                <TableHead className="numeric w-28">Unapplied</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <EnteredByHead />
                <TableHead className="w-24 print:hidden" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.rows.map((payment) => (
                <ClickableRow
                  key={payment.id}
                  href={`/payments/${payment.id}`}
                  title={`Open payment ${payment.number}`}
                >
                  <TableCell className="tabular font-medium">
                    <Link
                      href={`/payments/${payment.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {payment.number}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                    {formatDate(toCalendarDate(payment.date))}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/customers?id=${payment.customer.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {payment.customer.displayName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {payment.depositAccount.code} {payment.depositAccount.name}
                  </TableCell>
                  <TableCell className="numeric tabular">{formatMoney(payment.amount, currency)}</TableCell>
                  <TableCell className="numeric tabular">
                    {Number(payment.unapplied) === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="font-medium">{formatMoney(payment.unapplied, currency)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[payment.status] ?? 'secondary'}>
                      {STATUS_LABELS[payment.status] ?? payment.status}
                    </Badge>
                  </TableCell>
                  <EnteredByCell trail={trails.get(payment.id)} />
                  <TableCell className="print:hidden">
                    <RowActions
                      actions={[
                        { label: 'Open', href: `/payments/${payment.id}`, icon: 'open' },
                        ...(canEdit && payment.status !== 'VOID'
                          ? [{ label: 'Edit', href: `/payments/${payment.id}/edit`, icon: 'edit' as const }]
                          : []),
                        ...(canReport
                          ? [
                              {
                                label: 'QuickReport',
                                href: `/reports/statements/customer?customerId=${payment.customer.id}&view=detail&period=all-dates`,
                              },
                            ]
                          : []),
                      ]}
                      onDelete={
                        canVoid && ctx.features.allowDocumentDelete && payment.status !== 'VOID'
                          ? { kind: 'customer-payment', id: payment.id, number: payment.number }
                          : undefined
                      }
                    />
                  </TableCell>
                </ClickableRow>
              ))}
            </TableBody>
          </Table>
          </ScrollSheet>
          <Pagination total={page.total} />
        </Card>
      )}
    </>
  )
}
