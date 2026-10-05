import Link from 'next/link'
import { PlusIcon, ReceiptIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { GiveFeedback } from '@/components/data/give-feedback'
import { PageHeader } from '@/components/data/page-header'
import { Pagination } from '@/components/data/pagination'
import { PrintPageButton } from '@/components/data/print-page-button'
import { QuerySelect } from '@/components/data/query-select'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { SearchInput } from '@/components/data/search-input'
import { TableToolbar } from '@/components/data/table-toolbar'
import { readSort } from '@/components/data/sortable-header'
import { PurchaseOrderTable } from '@/components/purchases/purchase-order-table'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDate, toCalendarDate, today } from '@/lib/date'
import { DATE_PRESETS, listHref, presetRange, readDatePreset } from '@/lib/list-filters'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as purchaseService from '@/server/services/purchase.service'
import { parseListQuery } from '@/lib/validation/common'

const SORTABLE = ['number', 'date', 'vendor', 'reference', 'dueDate', 'total', 'status'] as const
const PATH = '/purchases/purchase-orders'

const DATE_OPTIONS = [
  { value: 'all', label: 'All dates' },
  ...DATE_PRESETS.filter((preset) => preset.value).map((preset) => ({ value: preset.value, label: preset.label })),
]

export async function PurchaseOrderScreen({
  search,
}: {
  search: Record<string, string | string[] | undefined>
}) {
  const ctx = await requireOrgContext('bill:read')
  const query = parseListQuery(search)
  const dateRaw = typeof search.date === 'string' ? search.date : 'year'
  const datePreset = dateRaw === 'all' ? '' : readDatePreset(dateRaw)
  const range = presetRange(datePreset, today(ctx.organization.timeZone))
  const vendorId = typeof search.vendorId === 'string' ? search.vendorId : ''
  const statusRaw = typeof search.status === 'string' ? search.status : ''
  const status = statusRaw === 'open' || statusRaw === 'draft' ? statusRaw : undefined
  const sort = readSort(search, SORTABLE, { sort: 'date', dir: 'desc' })

  const [page, vendors] = await Promise.all([
    purchaseService.listOrderBoard(ctx, query, {
      status,
      vendorId: vendorId || undefined,
      ...sort,
      from: range?.from,
      to: range?.to,
    }),
    db.vendor.findMany({
      where: { orgId: ctx.orgId },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    }),
  ])

  const canCreate = ctx.permissions.has('bill:create')
  const hidden = {
    q: query.q,
    vendorId: vendorId || undefined,
    date: dateRaw,
    status,
    sort: sort.sort,
    dir: sort.dir,
  }

  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Orders placed with vendors. Nothing is posted until the goods are billed."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <GiveFeedback />
            {canCreate ? (
              <Link href="/purchases/purchase-orders/new" className={buttonVariants({ size: 'sm' })}>
                <PlusIcon /> Add purchase order
              </Link>
            ) : null}
            <PrintPageButton />
            <TableToolbar
              exportHref={`/api/exports/purchase-orders?${new URLSearchParams(
                Object.entries({
                  q: query.q,
                  vendorId: vendorId || undefined,
                  date: datePreset || undefined,
                  status,
                  sort: sort.sort,
                  dir: sort.dir,
                }).filter((entry): entry is [string, string] => Boolean(entry[1])),
              ).toString()}`}
            />
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <QuerySelect
          label="Supplier"
          param="vendorId"
          path={PATH}
          value={vendorId}
          hidden={{ ...hidden, vendorId: undefined }}
          options={[{ value: '', label: 'All' }, ...vendors.map((vendor) => ({ value: vendor.id, label: vendor.displayName }))]}
        />
        <QuerySelect
          label="Purchase Order Date"
          param="date"
          path={PATH}
          value={dateRaw === 'year' || datePreset ? dateRaw : 'all'}
          hidden={{ ...hidden, date: undefined }}
          options={DATE_OPTIONS}
        />
        <QuerySelect
          label="Status"
          param="status"
          path={PATH}
          value={status ?? ''}
          hidden={{ ...hidden, status: undefined }}
          options={[
            { value: '', label: 'All' },
            { value: 'open', label: 'To receive' },
            { value: 'draft', label: 'Drafts' },
          ]}
        />
      </div>

      {range ? (
        <div className="mb-3">
          <Link
            href={listHref(PATH, { ...hidden, date: 'all' })}
            className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs"
          >
            Purchase Order Date: {formatDate(range.from)} – {formatDate(range.to)}
            <span aria-hidden>×</span>
          </Link>
        </div>
      ) : null}

      <div className="mb-4">
        <SearchInput placeholder="Search number, reference or supplier" />
      </div>

      {page.total === 0 ? (
        <EmptyState
          icon={ReceiptIcon}
          title="No purchase orders match"
          description="Try another supplier or date, or add a purchase order."
          action={
            canCreate ? (
              <Link href="/purchases/purchase-orders/new" className={buttonVariants({ size: 'sm' })}>
                <PlusIcon /> Add purchase order
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ScrollSheet>
            <PurchaseOrderTable
              currency={ctx.organization.baseCurrency}
              canEdit={ctx.permissions.has('bill:update')}
              canReceive={ctx.permissions.has('bill:create')}
              rows={page.rows.map((row) => ({
                id: row.id,
                number: row.number,
                date: formatDate(toCalendarDate(row.date)),
                dueDate: row.dueDate ? formatDate(toCalendarDate(row.dueDate)) : null,
                status: row.status,
                memo: row.memo,
                subtotal: row.subtotal,
                taxTotal: row.taxTotal,
                total: row.total,
                vendorName: row.vendor.displayName,
                email: row.vendor.email,
                category: row.category,
                location: row.location,
                attachments: row.attachments,
              }))}
            />
          </ScrollSheet>
          <Pagination total={page.total} />
        </Card>
      )}
    </>
  )
}
