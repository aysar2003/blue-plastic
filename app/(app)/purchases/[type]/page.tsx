import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PackageIcon, PlusIcon, ReceiptIcon } from 'lucide-react'

import { ClickableRow } from '@/components/data/clickable-row'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Pagination } from '@/components/data/pagination'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { RowActions } from '@/components/data/row-actions'
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
import { formatDate, formatTransactionDate, toCalendarDate, today } from '@/lib/date'
import { DATE_PRESETS, presetRange, readDatePreset } from '@/lib/list-filters'
import { formatMoney } from '@/lib/money'
import { purchaseBySlug } from '@/lib/purchase-types'
import { STATUS_LABELS, STATUS_VARIANTS } from '@/lib/sales-types'
import { cn } from '@/lib/utils'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import { trailsFor } from '@/server/services/audit.service'
import * as purchaseService from '@/server/services/purchase.service'
import { ExpenseScreen } from '../expense-screen'
import { PurchaseOrderScreen } from '../purchase-order-screen'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>
}): Promise<Metadata> {
  return { title: purchaseBySlug((await params).type)?.plural ?? 'Purchases' }
}

const BILL_FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'draft', label: 'Drafts' },
]

const SORTABLE = ['number', 'date', 'vendor', 'reference', 'dueDate', 'total', 'status'] as const

export default async function PurchaseListPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const config = purchaseBySlug((await params).type)
  if (!config) notFound()

  const search = await searchParams
  if (config.type === 'PURCHASE_ORDER') return <PurchaseOrderScreen search={search} />
  if (config.type === 'EXPENSE') return <ExpenseScreen search={search} />

  const ctx = await requireOrgContext('bill:read')
  const query = parseListQuery(search)
  const statusOptions = config.type === 'BILL' ? BILL_FILTERS : null
  const statusRaw = typeof search.status === 'string' ? search.status : ''
  const status = statusOptions?.some((option) => option.value === statusRaw) ? statusRaw : undefined
  const vendorId = typeof search.vendorId === 'string' ? search.vendorId : undefined
  const datePreset = readDatePreset(search.date)
  const range = presetRange(datePreset, today(ctx.organization.timeZone))
  const sort = readSort(search, SORTABLE, { sort: 'date', dir: 'desc' })

  const page = await purchaseService.list(ctx, config.type, query, {
    status,
    vendorId,
    ...sort,
    from: range?.from,
    to: range?.to,
  })
  const trails = await trailsFor(ctx, page.rows.map((row) => row.id))
  const basePath = `/purchases/${config.slug}`
  const canEditDocuments = ctx.permissions.has('bill:update')
  const canDelete = ctx.features.allowDocumentDelete && ctx.permissions.has('bill:void')
  const canReceive = ctx.permissions.has('bill:create')
  const linkParams = {
    q: query.q,
    status: status || undefined,
    vendorId: vendorId || undefined,
    date: datePreset || undefined,
    sort: sort.sort,
    dir: sort.dir,
  }
  const narrowed = Boolean(query.q || status || vendorId || datePreset)
  const currency = ctx.organization.baseCurrency
  const now = today(ctx.organization.timeZone)

  const newButton = ctx.permissions.has('bill:create') ? (
    <Link href={`/purchases/${config.slug}/new`} className={buttonVariants({ size: 'sm' })}>
      <PlusIcon /> New {config.singular.toLowerCase()}
    </Link>
  ) : undefined

  return (
    <>
      <PageHeader title={config.plural} description={config.effect} actions={newButton} />

      <div className="mb-3 flex flex-col gap-2">
        <FilterChips options={[...DATE_PRESETS]} active={datePreset} path={basePath} param="date" params={linkParams} />
        {statusOptions ? (
          <FilterChips options={statusOptions} active={status ?? ''} path={basePath} param="status" params={linkParams} />
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search number, reference or vendor" />
        <EnteredByToggle />
        <TableToolbar exportHref={`/api/exports/${config.slug}?${new URLSearchParams(
          Object.entries(linkParams).filter((entry): entry is [string, string] => Boolean(entry[1])),
        ).toString()}`} />
      </div>

      {page.total === 0 ? (
        <EmptyState
          icon={ReceiptIcon}
          title={narrowed ? `No ${config.plural.toLowerCase()} match` : `No ${config.plural.toLowerCase()} yet`}
          description={narrowed ? 'Try a different search or filter.' : config.effect}
          action={!narrowed ? newButton : undefined}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ScrollSheet>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="number" label="Number" state={sort} basePath={basePath} params={linkParams} className="w-32" />
                <SortableHeader column="date" label="Date" state={sort} basePath={basePath} params={linkParams} className="w-44" defaultDirection="desc" />
                <SortableHeader column="vendor" label="Vendor" state={sort} basePath={basePath} params={linkParams} />
                <SortableHeader column="reference" label="Their ref" state={sort} basePath={basePath} params={linkParams} />
                {config.type === 'BILL' ? (
                  <SortableHeader column="dueDate" label="Due" state={sort} basePath={basePath} params={linkParams} className="w-28" />
                ) : null}
                <SortableHeader column="total" label="Total" state={sort} basePath={basePath} params={linkParams} className="w-32" numeric defaultDirection="desc" />
                {config.type === 'BILL' ? <TableHead className="numeric w-32">Owing</TableHead> : null}
                <SortableHeader column="status" label="Status" state={sort} basePath={basePath} params={linkParams} className="w-24" />
                <EnteredByHead />
                <TableHead className="w-10 print:hidden" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.rows.map((row) => {
                const overdue =
                  row.dueDate &&
                  toCalendarDate(row.dueDate) < now &&
                  (row.status === 'OPEN' || row.status === 'PARTIAL')

                return (
                  <ClickableRow
                    key={row.id}
                    href={`/purchases/${config.slug}/${row.id}`}
                    title={`Open ${config.singular.toLowerCase()} ${row.number}`}
                  >
                    <TableCell>
                      <Link
                        href={`/purchases/${config.slug}/${row.id}`}
                        className="tabular font-medium underline-offset-4 hover:underline"
                      >
                        {row.number}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                      {formatTransactionDate(toCalendarDate(row.date), row.createdAt, ctx.organization.timeZone)}
                    </TableCell>
                    <TableCell>{row.vendor.displayName}</TableCell>
                    <TableCell className="text-muted-foreground">{row.reference ?? '—'}</TableCell>
                    {config.type === 'BILL' ? (
                      <TableCell
                        className={cn(
                          'tabular whitespace-nowrap',
                          overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {row.dueDate ? formatDate(toCalendarDate(row.dueDate)) : '—'}
                      </TableCell>
                    ) : null}
                    <TableCell className="numeric tabular">{formatMoney(row.total, currency)}</TableCell>
                    {config.type === 'BILL' ? (
                      <TableCell className="numeric tabular font-medium">
                        {Number(row.balance) === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatMoney(row.balance, currency)
                        )}
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[row.status] ?? 'secondary'}>
                        {STATUS_LABELS[row.status] ?? row.status}
                      </Badge>
                    </TableCell>
                    <EnteredByCell trail={trails.get(row.id)} />
                    <TableCell className="print:hidden">
                      <div className="flex items-center justify-end gap-0.5">
                        {config.type === 'PURCHASE_ORDER' &&
                        canReceive &&
                        row.status !== 'VOID' &&
                        row.status !== 'DRAFT' &&
                        row.status !== 'CLOSED' ? (
                          <Link
                            href={`/purchases/purchase-orders/${row.id}/receive`}
                            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                            title="Receive items"
                          >
                            <PackageIcon />
                            Receive
                          </Link>
                        ) : null}
                        <RowActions
                          actions={[
                            { label: 'Open', href: `${basePath}/${row.id}`, icon: 'open' as const },
                            ...(canEditDocuments && row.status !== 'VOID'
                              ? [{ label: 'Edit', href: `${basePath}/${row.id}/edit`, icon: 'edit' as const }]
                              : []),
                            ...(config.type === 'PURCHASE_ORDER' &&
                            canReceive &&
                            row.status !== 'VOID' &&
                            row.status !== 'DRAFT' &&
                            row.status !== 'CLOSED'
                              ? [
                                  {
                                    label: 'Receive items',
                                    href: `/purchases/purchase-orders/${row.id}/receive`,
                                    icon: 'open' as const,
                                  },
                                ]
                              : []),
                          ]}
                          onDelete={
                            canDelete
                              ? { kind: 'purchase', id: row.id, number: row.number }
                              : undefined
                          }
                        />
                      </div>
                    </TableCell>
                  </ClickableRow>
                )
              })}
            </TableBody>
          </Table>
          </ScrollSheet>
          <Pagination total={page.total} />
        </Card>
      )}
    </>
  )
}
