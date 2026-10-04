import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FileTextIcon, PlusIcon } from 'lucide-react'

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
import { formatDate, toCalendarDate, toDate, today } from '@/lib/date'
import { DATE_PRESETS, isDatePreset, presetRange, readDatePreset } from '@/lib/list-filters'
import { formatMoney } from '@/lib/money'
import { ConvertEstimateButton } from '@/components/sales/document-actions'
import { EstimateHome } from '@/components/sales/estimate-home'
import { EstimateRegister } from '@/components/sales/estimate-register'
import { InvoiceHome } from '@/components/sales/invoice-home'
import { InvoiceRegister } from '@/components/sales/invoice-register'
import { ReceiptHome } from '@/components/sales/receipt-home'
import { ReceiptRegister } from '@/components/sales/receipt-register'
import { bySlug, STATUS_LABELS, STATUS_VARIANTS } from '@/lib/sales-types'
import { cn } from '@/lib/utils'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import { trailsFor } from '@/server/services/audit.service'
import * as salesService from '@/server/services/sales.service'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>
}): Promise<Metadata> {
  const config = bySlug((await params).type)
  return { title: config?.plural ?? 'Sales' }
}

const SORTABLE = ['number', 'date', 'customer', 'dueDate', 'total', 'status'] as const

const INVOICE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'notdue', label: 'Not due yet' },
  { value: 'paid', label: 'Paid' },
  { value: 'draft', label: 'Drafts' },
]

const INVOICE_DATES = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'This month' },
  { value: 'last', label: 'Last month' },
  { value: 'last3', label: 'Last 3 months' },
  { value: 'year', label: 'This year' },
]

const RECEIPT_FILTERS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Drafts' },
]

const ESTIMATE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'draft', label: 'Drafts' },
]

const ESTIMATE_DATES = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'This month' },
  { value: 'last', label: 'Last month' },
  { value: 'last3', label: 'Last 3 months' },
  { value: 'year', label: 'This year' },
]

export default async function SalesListPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const config = bySlug((await params).type)
  if (!config) notFound()

  const ctx = await requireOrgContext('invoice:read')
  const search = await searchParams
  const query = parseListQuery(search)
  const statusOptions =
    config.type === 'INVOICE'
      ? INVOICE_FILTERS
      : config.type === 'SALES_RECEIPT'
        ? RECEIPT_FILTERS
        : config.type === 'ESTIMATE'
          ? ESTIMATE_FILTERS
          : null
  const statusRaw = typeof search.status === 'string' ? search.status : ''
  const status = statusOptions?.some((option) => option.value === statusRaw) ? statusRaw : undefined
  const customerId = typeof search.customer === 'string' && search.customer ? search.customer : undefined
  const rawDate = typeof search.date === 'string' ? search.date : undefined
  const dashboard =
    config.type === 'INVOICE' || config.type === 'SALES_RECEIPT' || config.type === 'ESTIMATE'
  // Invoices, sales receipts, and quotations open on the last three months, the
  // same starting range as the QuickBooks list. "All dates" is an explicit choice.
  const datePreset = dashboard
    ? rawDate === 'all'
      ? ''
      : rawDate && isDatePreset(rawDate) && rawDate !== ''
        ? rawDate
        : 'last3'
    : readDatePreset(search.date)
  const range = presetRange(datePreset, today(ctx.organization.timeZone))
  const sort = readSort(search, SORTABLE, { sort: 'date', dir: 'desc' })

  const [page, receiptHome, invoiceHome, estimateHome, choices] = await Promise.all([
    salesService.list(ctx, config.type, query, {
      status,
      customerId,
      ...sort,
      from: range?.from,
      to: range?.to,
    }),
    config.type === 'SALES_RECEIPT' ? salesService.receiptHome(ctx) : Promise.resolve(null),
    config.type === 'INVOICE' ? salesService.invoiceHome(ctx) : Promise.resolve(null),
    config.type === 'ESTIMATE' ? salesService.estimateHome(ctx) : Promise.resolve(null),
    dashboard ? salesService.customerChoices(ctx) : Promise.resolve([]),
  ])
  const trails = await trailsFor(ctx, page.rows.map((row) => row.id))
  const currency = ctx.organization.baseCurrency
  const now = today(ctx.organization.timeZone)

  const basePath = `/sales/${config.slug}`
  const customers = choices.map((customer) => ({ value: customer.id, label: customer.displayName }))
  const linkParams = {
    q: query.q,
    status: status || undefined,
    customer: customerId,
    date: dashboard ? datePreset || 'all' : datePreset || undefined,
    sort: sort.sort,
    dir: sort.dir,
  }
  const narrowed = Boolean(query.q || status || datePreset)

  const canCreate = ctx.permissions.has(config.createPermission)
  const canCreateInvoice = ctx.permissions.has('invoice:create')
  const canEditDocuments = ctx.permissions.has('invoice:update')
  const canDelete = ctx.permissions.has('invoice:void')
  const convertToday = today(ctx.organization.timeZone)
  const newButton = canCreate ? (
    <Link href={`/sales/${config.slug}/new`} className={buttonVariants({ size: 'sm' })}>
      <PlusIcon /> New {config.singular.toLowerCase()}
    </Link>
  ) : undefined

  return (
    <>
      {receiptHome ? (
        <ReceiptHome
          currency={currency}
          canCreate={canCreate}
          active={datePreset || 'all'}
          params={linkParams}
          home={receiptHome}
        />
      ) : invoiceHome ? (
        <InvoiceHome
          currency={currency}
          canCreate={canCreate}
          active={status ?? ''}
          params={linkParams}
          home={invoiceHome}
        />
      ) : estimateHome ? (
        <EstimateHome
          currency={currency}
          canCreate={canCreate}
          active={status ?? ''}
          params={linkParams}
          home={estimateHome}
        />
      ) : (
        <PageHeader title={config.plural} description={config.effect} actions={newButton} />
      )}

      {invoiceHome ? (
        <InvoiceRegister
          customers={customers}
          rows={page.rows.map((row) => {
            const due = row.dueDate ? toCalendarDate(row.dueDate) : null
            const open = row.status === 'OPEN' || row.status === 'PARTIAL'
            const overdue = Boolean(due && due < now && open)
            const days = overdue && due ? Math.round((toDate(now).getTime() - toDate(due).getTime()) / 86_400_000) : 0
            const trail = trails.get(row.id)
            const later = trail?.changed && trail.changed.name !== trail.entered?.name
            return {
              id: row.id,
              number: row.number,
              date: toCalendarDate(row.date),
              due,
              customer: row.customer.displayName,
              amount: formatMoney(row.total, currency),
              balance: formatMoney(row.balance, currency),
              statusText: overdue ? `Overdue ${days} ${days === 1 ? 'day' : 'days'}` : (STATUS_LABELS[row.status] ?? row.status),
              overdue,
              href: `${basePath}/${row.id}`,
              editHref: canEditDocuments && row.status !== 'VOID' ? `${basePath}/${row.id}/edit` : null,
              printHref: `${basePath}/${row.id}/print`,
              payHref:
                ctx.permissions.has('payment:create') && open ? `/payments/new?customer=${row.customer.id}` : null,
              recorded: trail?.entered ? (later ? `${trail.entered.name} · ${trail.changed?.name}` : trail.entered.name) : null,
              canDelete,
            }
          })}
          basePath={basePath}
          params={linkParams}
          sort={sort}
          statusOptions={INVOICE_FILTERS}
          dateOptions={INVOICE_DATES}
          status={status ?? ''}
          date={datePreset || 'all'}
          canCreate={canCreate}
          canPay={ctx.permissions.has('payment:create')}
          page={page.page}
          pageCount={page.pageCount}
          total={page.total}
          pageSize={page.pageSize}
        />
      ) : null}

      {receiptHome ? (
        <ReceiptRegister
          customers={customers}
          rows={page.rows.map((row) => {
            const trail = trails.get(row.id)
            const later = trail?.changed && trail.changed.name !== trail.entered?.name
            const account = row.depositAccount
            return {
              id: row.id,
              number: row.number,
              date: toCalendarDate(row.date),
              customer: row.customer.displayName,
              amount: formatMoney(row.total, currency),
              deposit: account ? `${account.code} ${account.name}` : '—',
              statusText:
                row.status === 'OPEN' || row.status === 'PAID' ? 'Paid' : (STATUS_LABELS[row.status] ?? row.status),
              href: `${basePath}/${row.id}`,
              editHref: canEditDocuments && row.status !== 'VOID' ? `${basePath}/${row.id}/edit` : null,
              printHref: `${basePath}/${row.id}/print`,
              recorded: trail?.entered ? (later ? `${trail.entered.name} · ${trail.changed?.name}` : trail.entered.name) : null,
              canDelete,
            }
          })}
          basePath={basePath}
          params={linkParams}
          sort={sort}
          statusOptions={RECEIPT_FILTERS}
          dateOptions={INVOICE_DATES}
          status={status ?? ''}
          date={datePreset || 'all'}
          canCreate={canCreate}
          page={page.page}
          pageCount={page.pageCount}
          total={page.total}
          pageSize={page.pageSize}
        />
      ) : null}

      {estimateHome ? (
        <EstimateRegister
          customers={customers}
          rows={page.rows.map((row) => {
            const trail = trails.get(row.id)
            const later = trail?.changed && trail.changed.name !== trail.entered?.name
            const canConvert =
              canCreateInvoice &&
              !row.convertedTo &&
              row.status !== 'VOID' &&
              row.status !== 'DECLINED' &&
              row.status !== 'CLOSED'
            return {
              id: row.id,
              number: row.number,
              date: toCalendarDate(row.date),
              customer: row.customer.displayName,
              amount: formatMoney(row.total, currency),
              statusText:
                row.status === 'CLOSED' ? 'Invoiced' : (STATUS_LABELS[row.status] ?? row.status),
              href: `${basePath}/${row.id}`,
              editHref: canEditDocuments && row.status !== 'VOID' ? `${basePath}/${row.id}/edit` : null,
              printHref: `${basePath}/${row.id}/print`,
              recorded: trail?.entered
                ? later
                  ? `${trail.entered.name} · ${trail.changed?.name}`
                  : trail.entered.name
                : null,
              canDelete,
              canConvert,
            }
          })}
          basePath={basePath}
          params={linkParams}
          sort={sort}
          statusOptions={ESTIMATE_FILTERS}
          dateOptions={ESTIMATE_DATES}
          status={status ?? ''}
          date={datePreset || 'all'}
          canCreate={canCreate}
          convertToday={convertToday}
          page={page.page}
          pageCount={page.pageCount}
          total={page.total}
          pageSize={page.pageSize}
        />
      ) : null}

      {invoiceHome || receiptHome || estimateHome ? null : <div className="mb-3 flex flex-col gap-2">
        <FilterChips options={[...DATE_PRESETS]} active={datePreset} path={basePath} param="date" params={linkParams} />
        {statusOptions ? (
          <FilterChips options={statusOptions} active={status ?? ''} path={basePath} param="status" params={linkParams} />
        ) : null}
      </div>}

      {invoiceHome || receiptHome || estimateHome ? null : <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search number, reference or customer" />
        <EnteredByToggle />
        <TableToolbar exportHref={`/api/exports/${config.slug}?${new URLSearchParams(
          Object.entries(linkParams).filter((entry): entry is [string, string] => Boolean(entry[1])),
        ).toString()}`} />
      </div>

      {page.total === 0 ? (
        <EmptyState
          icon={FileTextIcon}
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
                <SortableHeader column="date" label="Date" state={sort} basePath={basePath} params={linkParams} className="w-28" defaultDirection="desc" />
                <SortableHeader column="customer" label="Customer" state={sort} basePath={basePath} params={linkParams} />
                {config.type === 'INVOICE' ? (
                  <SortableHeader column="dueDate" label="Due" state={sort} basePath={basePath} params={linkParams} className="w-28" />
                ) : null}
                <SortableHeader column="total" label="Total" state={sort} basePath={basePath} params={linkParams} className="w-32" numeric defaultDirection="desc" />
                {config.type === 'INVOICE' ? (
                  <TableHead className="numeric w-32">Outstanding</TableHead>
                ) : null}
                <SortableHeader column="status" label="Status" state={sort} basePath={basePath} params={linkParams} className="w-28" />
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
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/sales/${config.slug}/${row.id}`}
                        className="tabular font-medium underline-offset-4 hover:underline"
                      >
                        {row.number}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                      {formatDate(toCalendarDate(row.date))}
                    </TableCell>
                    <TableCell>{row.customer.displayName}</TableCell>
                    {config.type === 'INVOICE' ? (
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
                    {config.type === 'INVOICE' ? (
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
                      <div className="flex items-center justify-end gap-1">
                        {config.type === 'ESTIMATE' &&
                        canCreateInvoice &&
                        !row.convertedTo &&
                        row.status !== 'VOID' &&
                        row.status !== 'DECLINED' &&
                        row.status !== 'CLOSED' ? (
                          <ConvertEstimateButton
                            id={row.id}
                            number={row.number}
                            today={convertToday}
                            variant="outline"
                            label="Invoice"
                          />
                        ) : null}
                        <RowActions
                          actions={[
                            { label: 'Open', href: `${basePath}/${row.id}`, icon: 'open' as const },
                            ...(canEditDocuments && row.status !== 'VOID'
                              ? [{ label: 'Edit', href: `${basePath}/${row.id}/edit`, icon: 'edit' as const }]
                              : []),
                            { label: 'Print', href: `${basePath}/${row.id}/print`, icon: 'print' as const },
                          ]}
                          onDelete={
                            canDelete
                              ? { kind: 'sales', id: row.id, number: row.number }
                              : undefined
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          </ScrollSheet>
          <Pagination total={page.total} />
        </Card>
      )}
      </>}
    </>
  )
}
