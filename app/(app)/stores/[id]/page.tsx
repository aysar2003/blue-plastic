import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PlusIcon } from 'lucide-react'

import { MetricCard } from '@/components/data/metric-card'
import { PageHeader } from '@/components/data/page-header'
import { SearchInput } from '@/components/data/search-input'
import { readSort, SortableHeader } from '@/components/data/sortable-header'
import { QtyCell } from '@/components/inventory/line-store'
import { StoreItemMenu } from '@/components/inventory/store-item-menu'
import { StoreKeeperPicks } from '@/components/inventory/store-keeper-picks'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatDateTime, toCalendarDate } from '@/lib/date'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import { cn } from '@/lib/utils'
import { requireOrgContext } from '@/server/auth/context'
import * as inventoryService from '@/server/services/inventory.service'
import * as storeService from '@/server/services/store.service'
import type { StoreScope, StoreView } from '@/server/services/store.service'

export const metadata: Metadata = { title: 'Store' }

const VIEWS: { value: StoreView; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in', label: 'In stock' },
  { value: 'zero', label: 'Zero' },
  { value: 'negative', label: 'Below zero' },
]

const SCOPES: { value: StoreScope; label: string }[] = [
  { value: 'store', label: 'This store' },
  { value: 'network', label: 'All stores' },
]

const SORTABLE = ['name', 'quantity', 'cost', 'value'] as const

function readView(value: string | string[] | undefined): StoreView {
  if (value === 'in' || value === 'zero' || value === 'negative') return value
  return 'all'
}

function readScope(value: string | string[] | undefined, isOffice: boolean): StoreScope {
  if (value === 'store' || value === 'network') return value
  return isOffice ? 'network' : 'store'
}

function hrefFor(
  id: string,
  params: {
    scope?: StoreScope
    view?: StoreView
    sort?: string
    dir?: string
    q?: string
  },
) {
  const search = new URLSearchParams()
  if (params.scope === 'store') search.set('scope', 'store')
  if (params.scope === 'network') search.set('scope', 'network')
  if (params.view && params.view !== 'all') search.set('view', params.view)
  if (params.q) search.set('q', params.q)
  if (params.sort) search.set('sort', params.sort)
  if (params.dir) search.set('dir', params.dir)
  const query = search.toString()
  return query ? `/stores/${id}?${query}` : `/stores/${id}`
}

export default async function StoreDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('inventory:read')
  const { id } = await params
  const search = await searchParams
  const view = readView(search.view)
  const sort = readSort(search, SORTABLE, { sort: 'name', dir: 'asc' })
  const q = typeof search.q === 'string' ? search.q.trim() : ''

  const [board, tickets, picks] = await Promise.all([
    storeService.dashboard(ctx, id, view).catch(() => null),
    inventoryService.ticketsForStore(ctx, id, 25),
    inventoryService.pendingSalePicks(ctx, id),
  ])
  if (!board) notFound()

  const isOffice = board.store.isOffice
  const scope = readScope(search.scope, isOffice)
  const network = board.network
  const office = board.storeColumns.find((store) => store.isOffice)?.id ?? null

  const currency = ctx.organization.baseCurrency
  const canEdit = ctx.permissions.has('item:update')
  const canAdjust = ctx.permissions.has('inventory:adjust')
  const canCreate = ctx.permissions.has('account:create')
  const canReceive = ctx.permissions.has('bill:read')
  const canRecordReceipt = ctx.permissions.has('bill:create')
  const canSell = ctx.permissions.has('invoice:create')
  const otherStores = network.stores.filter((store) => store.id !== id)
  const showNetwork = scope === 'network'

  const linkParams = {
    scope,
    view: view === 'all' ? undefined : view,
    q: q || undefined,
    sort: sort.sort,
    dir: sort.dir,
  }

  const needle = q.toLowerCase()
  const direction = sort.dir === 'asc' ? 1 : -1
  const source = showNetwork ? board.matrix : board.items
  const items = [...source]
    .filter((item) => {
      if (!needle) return true
      return (
        item.name.toLowerCase().includes(needle) ||
        (item.sku?.toLowerCase().includes(needle) ?? false)
      )
    })
    .sort((a, b) => {
      switch (sort.sort) {
        case 'quantity':
          return direction * a.quantity.comparedTo(b.quantity)
        case 'cost':
          return direction * a.averageCost.comparedTo(b.averageCost)
        case 'value':
          return direction * a.value.comparedTo(b.value)
        default:
          return direction * a.name.localeCompare(b.name)
      }
    })

  const listTotal = items.reduce((sum, item) => sum.plus(item.value), ZERO)
  const basePath = `/stores/${id}`
  const counts = showNetwork ? board.networkCounts : board.counts
  const stockValue = showNetwork ? board.networkStockValue : board.stockValue
  const storeColCount = board.storeColumns.length
  const colSpan = showNetwork ? 4 + storeColCount : 5

  return (
    <>
      <PageHeader
        title={isOffice ? 'Office · Store home' : board.store.name}
        description={
          isOffice
            ? 'Main store door. Pick All stores for every shelf side by side, or This store for only what sits in the office. Sale tickets for other stores appear on each store’s Ready to issue list.'
            : `Store keeper board for ${board.store.name}. Sale tickets from the office land under Ready to issue — prepare goods for the customer, then mark prepared.`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!isOffice && office ? (
              <Link href={`/stores/${office}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Office
              </Link>
            ) : null}
            {canCreate ? (
              <Link href={`/stores/${id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Edit store
              </Link>
            ) : null}
            <Link
              href={`/stores/tickets?store=${id}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              All tickets
            </Link>
            {canAdjust ? (
              <>
                <Link
                  href={`/stores/tickets/new?from=${id}`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  New ticket
                </Link>
                <Link
                  href={`/stores/transfer/new?from=${id}`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  Transfer to store
                </Link>
              </>
            ) : null}
            {canReceive ? (
              <Link
                href={`/stores/${id}/receive`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
                title={
                  canRecordReceipt
                    ? 'Receive purchase orders for this store'
                    : 'See orders still to receive for this store'
                }
              >
                Receive
              </Link>
            ) : null}
            {canCreate ? (
              <Link href="/stores/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <PlusIcon /> New store
              </Link>
            ) : null}
            {canSell ? (
              <Link href={`/sales/invoice/new?store=${id}`} className={buttonVariants({ size: 'sm' })}>
                Sell
              </Link>
            ) : null}
          </div>
        }
      />

      {isOffice ? (
        <section className="mb-6 space-y-3">
          <div>
            <h2 className="text-base font-semibold">All stores</h2>
            <p className="text-sm text-muted-foreground">
              Combined stock across {network.storeCount}{' '}
              {network.storeCount === 1 ? 'store' : 'stores'} — open a card for one store&apos;s shelf.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Stores" value={network.storeCount} tone="info" />
            <MetricCard label="In stock (lines)" value={network.inStock} tone="stock" />
            <MetricCard label="Below zero (lines)" value={network.negative} tone="danger" />
            <MetricCard
              label="Total cost (all stores)"
              value={formatMoney(network.stockValue, currency)}
              tone="money"
            />
          </div>
          {otherStores.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {otherStores.map((store) => (
                <Link key={store.id} href={`/stores/${store.id}`} className="block">
                  <Card
                    tone={store.negative > 0 ? 'danger' : store.inStock > 0 ? 'stock' : 'zero'}
                    className="h-full transition-opacity hover:opacity-90"
                  >
                    <CardContent className="grid gap-3 p-4">
                      <div>
                        <p className="font-medium">{store.name}</p>
                        <p className="text-xs opacity-70">
                          {store.code} {store.accountName}
                        </p>
                        {store.address ? (
                          <p className="mt-1 text-xs opacity-80">{store.address}</p>
                        ) : null}
                        {store.phone ? (
                          <p className="text-xs opacity-80">Phone {store.phone}</p>
                        ) : null}
                        {store.keyHolderName ? (
                          <p className="text-xs opacity-80">
                            Key: {store.keyHolderName}
                            {store.keyHolderPhone ? ` · ${store.keyHolderPhone}` : ''}
                          </p>
                        ) : null}
                      </div>
                      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        <div>
                          <dt className="text-xs opacity-70">In stock</dt>
                          <dd className="tabular font-medium">{store.inStock}</dd>
                        </div>
                        <div>
                          <dt className="text-xs opacity-70">Zero</dt>
                          <dd className="tabular font-medium">{store.zero}</dd>
                        </div>
                        <div>
                          <dt className="text-xs opacity-70">Below zero</dt>
                          <dd className="tabular font-medium">{store.negative}</dd>
                        </div>
                        <div>
                          <dt className="text-xs opacity-70">Total cost</dt>
                          <dd className="tabular font-semibold">
                            {formatMoney(store.stockValue, currency)}
                          </dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : null}
          {canCreate ? (
            <div className="flex justify-end pt-1">
              <Link href="/stores/new" className={buttonVariants({ size: 'sm' })}>
                <PlusIcon /> New store
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="mb-6" id="ready-to-issue">
        <StoreKeeperPicks
          picks={picks}
          timeZone={ctx.organization.timeZone}
          canPrepare={canAdjust}
        />
      </div>

      <section className="mb-6 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Store tickets</h2>
            <p className="text-sm text-muted-foreground">
              Every ticket from this shelf — sales picks, transfers, and manual issues.
            </p>
          </div>
          {canAdjust ? (
            <Link href={`/stores/tickets/new?from=${id}`} className={buttonVariants({ size: 'sm' })}>
              <PlusIcon /> New ticket
            </Link>
          ) : null}
        </div>
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="ledger-head hover:bg-[var(--band)]">
                <TableHead className="w-28">Ticket</TableHead>
                <TableHead className="w-36">Issued</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Customer / to</TableHead>
                <TableHead className="w-28">Sale</TableHead>
                <TableHead className="w-28">Seller</TableHead>
                <TableHead className="numeric w-24">Qty</TableHead>
                <TableHead className="w-28">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                    No tickets from this store yet.
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket, index) => (
                  <TableRow
                    key={ticket.id}
                    className={index % 2 === 1 ? 'ledger-row-alt' : 'ledger-row'}
                  >
                    <TableCell className="font-medium tabular">
                      <Link
                        href={`/stores/tickets/${ticket.id}/print`}
                        className="underline-offset-4 hover:underline"
                      >
                        {ticket.number}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground">
                      <div>{formatDate(toCalendarDate(ticket.date))}</div>
                      <div className="text-xs">
                        {formatDateTime(ticket.createdAt, ctx.organization.timeZone)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/items/${ticket.item.id}/report`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {ticket.item.name}
                      </Link>
                      {ticket.item.sku ? (
                        <span className="block text-xs text-muted-foreground">{ticket.item.sku}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {ticket.origin === 'SALE'
                        ? ticket.takenBy ?? '—'
                        : ticket.toStore?.name ?? ticket.takenBy ?? '—'}
                    </TableCell>
                    <TableCell className="tabular">
                      {ticket.salesDocument ? (
                        <Link
                          href={
                            ticket.salesDocument.type === 'SALES_RECEIPT'
                              ? `/sales/sales-receipts/${ticket.salesDocument.id}`
                              : `/sales/invoices/${ticket.salesDocument.id}`
                          }
                          className="underline-offset-4 hover:underline"
                        >
                          {ticket.salesDocument.number}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{ticket.sellerName ?? '—'}</TableCell>
                    <TableCell className="numeric tabular">
                      {new Decimal(ticket.quantity.toString()).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {ticket.origin === 'SALE' ? (
                        ticket.preparedAt ? (
                          <Badge variant="success">Prepared</Badge>
                        ) : (
                          <Badge variant="warning">To prepare</Badge>
                        )
                      ) : (
                        <Badge variant="secondary">
                          {ticket.origin === 'MANUAL' ? 'Manual' : 'Transfer'}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      {(board.store.address ||
        board.store.phone ||
        board.store.keyHolderName ||
        board.store.keyHolderPhone) &&
      !showNetwork ? (
        <Card className="mb-4">
          <CardContent className="grid gap-2 p-4 text-sm sm:grid-cols-2">
            {board.store.address ? (
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p>{board.store.address}</p>
              </div>
            ) : null}
            {board.store.phone ? (
              <div>
                <p className="text-xs text-muted-foreground">Store phone</p>
                <p>{board.store.phone}</p>
              </div>
            ) : null}
            {board.store.keyHolderName ? (
              <div>
                <p className="text-xs text-muted-foreground">Key holder</p>
                <p>{board.store.keyHolderName}</p>
              </div>
            ) : null}
            {board.store.keyHolderPhone ? (
              <div>
                <p className="text-xs text-muted-foreground">Key holder phone</p>
                <p>{board.store.keyHolderPhone}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-2">
        <h2 className="text-base font-semibold">
          {showNetwork ? 'Every store' : isOffice ? 'In this office' : 'In this store'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {showNetwork
            ? 'One row per item — quantity in each store as its own column, then the network total.'
            : isOffice
              ? 'Only quantity held at the office — switch to All stores for every shelf.'
              : 'Quantity in this store only — switch to All stores for every shelf side by side.'}
        </p>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6">
        <MetricCard label="In stock" value={counts.inStock} tone="stock" />
        <MetricCard label="Zero" value={counts.zero} tone="zero" />
        <MetricCard label="Below zero" value={counts.negative} tone="danger" />
        <MetricCard label="Total cost" value={formatMoney(stockValue, currency)} tone="money" />
        <MetricCard
          label={showNetwork ? 'Stores' : 'Store account'}
          value={showNetwork ? network.storeCount : formatMoney(board.accountBalance, currency)}
          tone={showNetwork ? 'info' : 'ledger'}
        />
        <MetricCard
          label="To prepare"
          value={picks.length}
          tone={picks.length > 0 ? 'warning' : 'info'}
          href="#ready-to-issue"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-md border border-border/60 p-0.5">
          {SCOPES.map((item) => {
            const active = scope === item.value
            return (
              <Link
                key={item.value}
                href={hrefFor(id, {
                  scope: item.value,
                  view,
                  q: q || undefined,
                  sort: sort.sort,
                  dir: sort.dir,
                })}
                className={cn(
                  'rounded-sm px-2.5 py-1 text-sm transition-colors',
                  active ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
        <div className="flex gap-1">
          {VIEWS.map((item) => {
            const active = view === item.value
            return (
              <Link
                key={item.value}
                href={hrefFor(id, {
                  scope,
                  view: item.value,
                  q: q || undefined,
                  sort: sort.sort,
                  dir: sort.dir,
                })}
                className={cn(
                  'rounded-md px-2.5 py-1 text-sm transition-colors',
                  active ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
        <SearchInput placeholder="Search item or SKU" />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="max-h-[70vh] overflow-x-auto overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="ledger-head hover:bg-[var(--band)]">
                <SortableHeader
                  column="name"
                  label="Item"
                  state={sort}
                  basePath={basePath}
                  params={linkParams}
                />
                {showNetwork ? (
                  <>
                    {board.storeColumns.map((store) => (
                      <TableHead key={store.id} className="numeric w-28">
                        {store.name}
                      </TableHead>
                    ))}
                    <SortableHeader
                      column="quantity"
                      label="Total"
                      state={sort}
                      basePath={basePath}
                      params={linkParams}
                      className="w-28"
                      numeric
                      defaultDirection="desc"
                    />
                  </>
                ) : (
                  <SortableHeader
                    column="quantity"
                    label="In this store"
                    state={sort}
                    basePath={basePath}
                    params={linkParams}
                    className="w-32"
                    numeric
                    defaultDirection="desc"
                  />
                )}
                <SortableHeader
                  column="cost"
                  label="Average cost"
                  state={sort}
                  basePath={basePath}
                  params={linkParams}
                  className="w-32"
                  numeric
                  defaultDirection="desc"
                />
                <SortableHeader
                  column="value"
                  label="Total cost"
                  state={sort}
                  basePath={basePath}
                  params={linkParams}
                  className="w-36"
                  numeric
                  defaultDirection="desc"
                />
                <TableHead className="w-12 print:hidden" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
                    {q ? 'No items match that search.' : 'Nothing in this view.'}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => (
                  <TableRow
                    key={item.itemId}
                    className={index % 2 === 1 ? 'ledger-row-alt' : 'ledger-row'}
                  >
                    <TableCell>
                      <Link
                        href={`/inventory/${item.itemId}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {item.name}
                      </Link>
                      {item.sku ? (
                        <span className="block text-xs text-muted-foreground">{item.sku}</span>
                      ) : null}
                    </TableCell>
                    {showNetwork ? (
                      <>
                        {board.storeColumns.map((store) => (
                          <TableCell key={store.id} className="numeric">
                            <QtyCell tracked quantity={item.storeQty?.[store.id] ?? '0.00'} />
                          </TableCell>
                        ))}
                        <TableCell
                          className={cn(
                            'numeric tabular font-medium',
                            item.quantity.isNegative() && 'text-[#C2410C]',
                            item.quantity.isZero() && 'text-muted-foreground',
                          )}
                        >
                          {item.quantity.toFixed(2)}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell
                        className={cn(
                          'numeric tabular',
                          item.quantity.isNegative() && 'text-[#C2410C]',
                          item.quantity.isZero() && 'text-muted-foreground',
                        )}
                      >
                        {item.quantity.toFixed(2)}
                      </TableCell>
                    )}
                    <TableCell className="numeric tabular text-muted-foreground">
                      {item.averageCost.isZero() ? '—' : formatMoney(item.averageCost, currency)}
                    </TableCell>
                    <TableCell className="numeric tabular font-medium">
                      {formatMoney(item.value, currency)}
                    </TableCell>
                    <TableCell className="print:hidden">
                      <StoreItemMenu
                        itemId={item.itemId}
                        itemName={item.name}
                        storeId={id}
                        canEdit={canEdit}
                        canAdjust={canAdjust}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {items.length > 0 ? (
              <TableFooter>
                <TableRow>
                  <TableCell
                    colSpan={showNetwork ? 1 + storeColCount + 1 + 1 : 3}
                    className="font-semibold"
                  >
                    Total cost
                    {q ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({items.length} shown)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="numeric tabular font-semibold">
                    {formatMoney(listTotal, currency)}
                  </TableCell>
                  <TableCell className="print:hidden" />
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </div>
      </Card>
    </>
  )
}
