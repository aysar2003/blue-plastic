import type { Metadata } from 'next'
import Link from 'next/link'
import { PackageIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Pagination } from '@/components/data/pagination'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { SearchInput } from '@/components/data/search-input'
import { TableToolbar } from '@/components/data/table-toolbar'
import { ImportDialog } from '@/components/master-data/import-dialog'
import { NewItemButton } from '@/components/master-data/item-dialog'
import { Card } from '@/components/ui/card'
import { today } from '@/lib/date'
import { cn } from '@/lib/utils'
import { readSort } from '@/components/data/sortable-header'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import * as accountService from '@/server/services/account.service'
import { ITEM_COLUMNS } from '@/server/services/import.service'
import { trailsFor } from '@/server/services/audit.service'
import * as itemService from '@/server/services/item.service'
import * as storeService from '@/server/services/store.service'
import * as taxService from '@/server/services/tax.service'
import { whoText } from '@/components/data/recorded-by'
import { ItemTable } from './item-table'

const SORTABLE = ['name', 'type', 'price', 'cost', 'sku'] as const

export const metadata: Metadata = { title: 'Products and services' }

const TYPE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'SERVICE', label: 'Services' },
  { value: 'NON_INVENTORY', label: 'Non-inventory' },
  { value: 'INVENTORY', label: 'Inventory' },
]

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('item:read')
  const params = await searchParams
  const query = parseListQuery(params)
  const type = typeof params.type === 'string' ? params.type : undefined
  const includeInactive = params.archived === '1'
  const sort = readSort(params, SORTABLE, { sort: 'type', dir: 'asc' })
  const linkParams = {
    q: query.q,
    type,
    archived: includeInactive ? '1' : undefined,
    sort: sort.sort,
    dir: sort.dir,
  }

  const [page, accounts, taxCodes, categories, shelf] = await Promise.all([
    itemService.list(ctx, query, { type, includeInactive, ...sort }),
    accountService.selectableAccounts(ctx),
    taxService.listCodes(ctx),
    itemService.listCategories(ctx),
    storeService.quantities(ctx),
  ])

  const editId = typeof params.edit === 'string' ? params.edit : undefined
  let extraEdit: Awaited<ReturnType<typeof itemService.get>> | null = null
  if (editId && !page.rows.some((row) => row.id === editId)) {
    try {
      extraEdit = await itemService.get(ctx, editId)
    } catch {
      extraEdit = null
    }
  }

  const trails = await trailsFor(ctx, page.rows.map((row) => row.id))
  const canCreate = ctx.permissions.has('item:create')
  const taxOptions = taxCodes.filter((c) => c.isActive).map((c) => ({ id: c.id, label: c.name }))
  const categoryOptions = categories.map((c) => ({ id: c.id, label: c.name }))
  const storeOptions = shelf.stores.map((store) => ({
    id: store.id,
    label: store.name,
    isOffice: store.isOffice,
  }))

  const newButton = canCreate ? (
    <NewItemButton
      accounts={accounts}
      taxCodes={taxOptions}
      categories={categoryOptions}
      stores={storeOptions}
      currency={ctx.organization.baseCurrency}
      today={today(ctx.organization.timeZone)}
    />
  ) : undefined

  return (
    <>
      <PageHeader
        title="Products and services"
        description="Everything the business sells, with what is on hand beside it. Click a row to open its report. An item carries the accounts it posts to and — when it is tracked — its stock."
        actions={
          <>
            {canCreate ? <ImportDialog kind="item" columns={ITEM_COLUMNS} /> : null}
            {newButton}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search name, SKU or description" />
        <div className="flex gap-1">
          {TYPE_FILTERS.map((filter) => {
            const active = (type ?? '') === filter.value
            const href = filter.value ? `/items?type=${filter.value}` : '/items'
            return (
              <Link
                key={filter.label}
                href={href}
                className={cn(
                  'rounded-md px-2.5 py-1 text-sm transition-colors',
                  active ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {filter.label}
              </Link>
            )
          })}
        </div>
        <Link
          href={includeInactive ? '/items' : '/items?archived=1'}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {includeInactive ? 'Hide archived' : 'Show archived'}
        </Link>
        <div className="ml-auto">
          <TableToolbar exportHref={`/api/exports/items?${new URLSearchParams(
            Object.entries(linkParams).filter((entry): entry is [string, string] => Boolean(entry[1])),
          ).toString()}`} />
        </div>
      </div>

      {page.total === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title={query.q || type ? 'No items match' : 'No products or services yet'}
          description={
            query.q || type
              ? 'Try a different search or filter.'
              : 'Add what the business sells. An inventory item also needs a stock account and a cost of goods sold account, so selling one moves both in the same journal as the sale.'
          }
          action={!query.q && !type ? newButton : undefined}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ScrollSheet>
            <ItemTable
              sort={sort}
              linkParams={linkParams}
              storeColumns={shelf.stores}
              rows={page.rows.map((row) => ({
                ...row,
                recorded: whoText(trails.get(row.id)),
                storeQty: shelf.byItem[row.id] ?? {},
              }))}
              accounts={accounts}
              taxCodes={taxOptions}
              categories={categoryOptions}
              stores={storeOptions}
              currency={ctx.organization.baseCurrency}
              canEdit={ctx.permissions.has('item:update')}
              canArchive={ctx.permissions.has('item:archive')}
              canAdjust={ctx.permissions.has('inventory:adjust')}
              startEditingId={editId}
              extraEdit={
                extraEdit
                  ? { ...extraEdit, onHand: null, stockValue: null, averageCost: null, belowReorder: false }
                  : null
              }
            />
          </ScrollSheet>
          <Pagination total={page.total} />
        </Card>
      )}
    </>
  )
}
