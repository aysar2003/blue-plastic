import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MetricCard } from '@/components/data/metric-card'
import { PageHeader } from '@/components/data/page-header'
import { ReportTable } from '@/components/reports/report-table'
import { buttonVariants } from '@/components/ui/button'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as inventoryService from '@/server/services/inventory.service'
import {
  activityTotals,
  itemActivity,
  type ActivityKind,
  type PriceView,
} from '@/server/services/item-activity'
import type { ReportColumn, ReportTable as ReportTableData } from '@/server/reports/catalogue'
import { readSettings, settingsToQuery, type SearchParams } from '@/app/(app)/reports/params'
import { ReportControls } from '@/app/(app)/reports/report-controls'

export const metadata: Metadata = { title: 'Item quick report' }

const KINDS: { value: ActivityKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sales', label: 'Sales' },
  { value: 'purchases', label: 'Purchases' },
  { value: 'tickets', label: 'Tickets' },
  { value: 'adjustments', label: 'Adjustments' },
]

const PRICES: { value: PriceView; label: string }[] = [
  { value: 'both', label: 'Cost and sales price' },
  { value: 'cost', label: 'Cost' },
  { value: 'sales', label: 'Sales price' },
]

function readKind(value: string | undefined): ActivityKind {
  return value === 'sales' ||
    value === 'purchases' ||
    value === 'adjustments' ||
    value === 'tickets'
    ? value
    : 'all'
}

function readPrice(value: string | undefined): PriceView {
  return value === 'cost' || value === 'sales' ? value : 'both'
}

export default async function ItemQuickReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('item:read')
  const { id } = await params
  const query = await searchParams
  const settings = readSettings(query, ctx.organization)
  const kind = readKind(typeof query.kind === 'string' ? query.kind : undefined)
  const price = readPrice(typeof query.price === 'string' ? query.price : undefined)

  const item = await db.item.findFirst({
    where: { id, orgId: ctx.orgId, deletedAt: null },
    select: { id: true, name: true, sku: true, type: true, salesPrice: true, purchaseCost: true },
  })
  if (!item) notFound()

  const tracked = item.type === 'INVENTORY'
  const [rows, stock] = await Promise.all([
    itemActivity(ctx, id, settings.range, kind),
    tracked ? inventoryService.stockOnHand(ctx) : Promise.resolve(null),
  ])
  const position = stock?.items.find((row) => row.itemId === id)
  const totals = activityTotals(rows)
  const currency = ctx.organization.baseCurrency
  const canAdjust = tracked && ctx.permissions.has('inventory:adjust')
  const canEdit = ctx.permissions.has('item:update')

  const columns: ReportColumn[] = [
    { key: 'date', label: 'Date', format: 'date', width: 'w-28' },
    { key: 'type', label: 'Type', width: 'w-36' },
    { key: 'number', label: 'No.', width: 'w-28' },
    { key: 'ticketNumber', label: 'Ticket', width: 'w-28' },
    { key: 'storeName', label: 'Store', width: 'w-40' },
    { key: 'party', label: 'Customer or vendor' },
    { key: 'quantity', label: 'Qty', format: 'signed', width: 'w-24' },
    { key: 'balance', label: 'Balance', format: 'number', width: 'w-28' },
  ]
  if (price !== 'sales') columns.push({ key: 'cost', label: 'Cost', format: 'money', width: 'w-28' })
  if (price !== 'cost') columns.push({ key: 'salesPrice', label: 'Sales price', format: 'money', width: 'w-32' })
  columns.push({ key: 'amount', label: 'Amount', format: 'money', width: 'w-32' })

  const table: ReportTableData = {
    columns,
    rows: rows.map((row) => {
      const cellHrefs: Record<string, string> = {}
      if (row.ticketHref && row.ticketNumber) cellHrefs.ticketNumber = row.ticketHref
      if (row.storeHref && row.storeName) cellHrefs.storeName = row.storeHref
      return {
        href: row.href,
        cellHrefs: Object.keys(cellHrefs).length > 0 ? cellHrefs : undefined,
        cells: {
          date: row.date,
          type: row.type,
          number: row.number || null,
          ticketNumber: row.ticketNumber || null,
          storeName: row.storeName || null,
          party: row.party || null,
          quantity: row.quantity,
          balance: row.balance,
          cost: row.cost,
          salesPrice: row.salesPrice,
          amount: row.amount,
        },
      }
    }),
    totals: {
      date: 'Total',
      quantity: totals.quantity.toFixed(2),
      balance: totals.balance ?? null,
      amount: totals.amount.toFixed(2),
    },
    empty: 'Nothing posted for this item in this period.',
    note: 'Store is the shelf goods left or entered. Ticket on a sale opens the pick ticket. Qty is the change (+ in, − out); Balance is on-hand after the line.',
  }

  const keep = settingsToQuery(settings, { kind, price })
  const chip = (next: Record<string, string>) => {
    const params = new URLSearchParams(keep)
    for (const [key, value] of Object.entries(next)) params.set(key, value)
    return `/items/${id}/report?${params.toString()}`
  }

  return (
    <>
      <PageHeader
        title={item.name}
        description={`${item.sku ? `${item.sku} · ` : ''}${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Link href={`/items?edit=${item.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Edit
              </Link>
            ) : null}
            {canAdjust ? (
              <Link
                href={`/inventory/adjustments/new?item=${item.id}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Adjustment
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="On hand"
          tone="stock"
          value={tracked ? (position ? position.quantity.toFixed(2) : '0.00') : 'Not tracked'}
        />
        <MetricCard
          label="Sales price"
          tone="sales"
          value={item.salesPrice ? formatMoney(item.salesPrice.toString(), currency) : '—'}
        />
        <MetricCard
          label={tracked ? 'Average cost' : 'Cost'}
          tone="money"
          value={
            tracked
              ? position && !position.averageCost.isZero()
                ? formatMoney(position.averageCost, currency)
                : '—'
              : item.purchaseCost
                ? formatMoney(item.purchaseCost.toString(), currency)
                : '—'
          }
        />
      </div>

      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: 'range', exportAs: undefined }}
      />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-1">
          {KINDS.map((filter) => (
            <Link
              key={filter.value}
              href={chip({ kind: filter.value })}
              className={cn(
                'rounded-md px-2.5 py-1 text-sm',
                kind === filter.value ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {filter.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {PRICES.map((filter) => (
            <Link
              key={filter.value}
              href={chip({ price: filter.value })}
              className={cn(
                'rounded-md px-2.5 py-1 text-sm',
                price === filter.value ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </div>

      <ReportTable table={table} currency={currency} />
    </>
  )
}
