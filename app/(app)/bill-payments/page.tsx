import type { Metadata } from 'next'
import Link from 'next/link'
import { BanknoteIcon, PlusIcon } from 'lucide-react'

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
import { DeleteButton } from '@/components/data/delete-record'
import { formatDate, toCalendarDate, today } from '@/lib/date'
import { DATE_PRESETS, presetRange, readDatePreset } from '@/lib/list-filters'
import { formatMoney } from '@/lib/money'
import { PAYMENT_METHOD_LABELS, STATUS_LABELS, STATUS_VARIANTS } from '@/lib/sales-types'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import { trailsFor } from '@/server/services/audit.service'
import * as billPaymentService from '@/server/services/bill-payment.service'

const SORTABLE = ['number', 'date', 'vendor', 'method', 'amount'] as const

export const metadata: Metadata = { title: 'Bill payments' }

export default async function BillPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('expense:read')
  const search = await searchParams
  const query = parseListQuery(search)
  const sort = readSort(search, SORTABLE, { sort: 'date', dir: 'desc' })
  const datePreset = readDatePreset(search.date)
  const range = presetRange(datePreset, today(ctx.organization.timeZone))
  const linkParams = { q: query.q, sort: sort.sort, dir: sort.dir, date: datePreset || undefined }
  const page = await billPaymentService.list(ctx, query, { ...sort, from: range?.from, to: range?.to })
  const trails = await trailsFor(ctx, page.rows.map((payment) => payment.id))
  const currency = ctx.organization.baseCurrency
  const canVoid = ctx.permissions.has('expense:void')

  const newButton = ctx.permissions.has('expense:create') ? (
    <Link href="/bill-payments/new" className={buttonVariants({ size: 'sm' })}>
      <PlusIcon /> Pay bills
    </Link>
  ) : undefined

  return (
    <>
      <PageHeader
        title="Bill payments"
        description="Money paid to vendors. One payment can settle several bills."
        actions={newButton}
      />

      <div className="mb-3">
        <FilterChips options={[...DATE_PRESETS]} active={datePreset} path="/bill-payments" param="date" params={linkParams} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search number, reference or vendor" />
        <EnteredByToggle />
        <div className="ml-auto">
          <TableToolbar exportHref={`/api/exports/bill-payments?${new URLSearchParams(
            Object.entries(linkParams).filter((entry): entry is [string, string] => Boolean(entry[1])),
          ).toString()}`} />
        </div>
      </div>

      {page.total === 0 ? (
        <EmptyState
          icon={BanknoteIcon}
          title={query.q || datePreset ? 'No payments match that filter' : 'No bill payments yet'}
          description={query.q || datePreset ? 'Try a different date or search.' : 'Settle what the business owes.'}
          action={!query.q && !datePreset ? newButton : undefined}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ScrollSheet>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="number" label="Number" state={sort} basePath="/bill-payments" params={linkParams} className="w-32" />
                <SortableHeader column="date" label="Date" state={sort} basePath="/bill-payments" params={linkParams} className="w-28" defaultDirection="desc" />
                <SortableHeader column="vendor" label="Vendor" state={sort} basePath="/bill-payments" params={linkParams} />
                <SortableHeader column="method" label="Method" state={sort} basePath="/bill-payments" params={linkParams} />
                <TableHead>From</TableHead>
                <SortableHeader column="amount" label="Amount" state={sort} basePath="/bill-payments" params={linkParams} className="w-28" numeric defaultDirection="desc" />
                <TableHead className="w-20">Status</TableHead>
                <EnteredByHead />
                <TableHead className="w-24 print:hidden" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.rows.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="tabular font-medium">
                    {payment.number}
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                    {formatDate(toCalendarDate(payment.date))}
                  </TableCell>
                  <TableCell>{payment.vendor.displayName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {payment.paymentAccount.code} {payment.paymentAccount.name}
                  </TableCell>
                  <TableCell className="numeric tabular">{formatMoney(payment.amount, currency)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[payment.status] ?? 'secondary'}>
                      {STATUS_LABELS[payment.status] ?? payment.status}
                    </Badge>
                  </TableCell>
                  <EnteredByCell trail={trails.get(payment.id)} />
                  <TableCell className="print:hidden">
                    {canVoid ? (
                      <DeleteButton
                        kind="bill-payment"
                        id={payment.id}
                        number={payment.number}
                        variant="ghost"
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
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
