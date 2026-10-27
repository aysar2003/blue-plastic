import type { Metadata } from 'next'
import Link from 'next/link'
import { PackageIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Pagination } from '@/components/data/pagination'
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
import { ItemFilters } from './item-filters'
import { ItemTable } from './item-table'

const SORTABLE = [
  'name',
  'type',
  'price',
  'cost',
  'sku',
  'barcode',
  'category',
  'salesDescription',
  'purchaseDescription',
  'reorderPoint',
  'unitOfMeasure',
  'store',
  'incomeAccount',
  'inventoryAccount',
  'cogsExpense',
  'onHand',
  'stockValue',
] as const

export const metadata: Metadata = { title: 'Products and services' }

function itemsQuery(values: Record<string, string | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value)
  }
  const text = params.toString()
  return text ? `/items?${text}` : '/items'
}

const TYPE_FILTERS = [
  { value: 'SERVICE', label: 'Service' },
  { value: 'INVENTORY', label: 'Inventory Part' },
  { value: 'INVENTORY_ASSEMBLY', label: 'Inventory Assembly' },
  { value: 'NON_INVENTORY', label: 'Non-inventory Part' },
  { value: 'OTHER_CHARGE', label: 'Other Charge' },
  { value: 'SUBTOTAL', label: 'Subtotal' },
  { value: 'GROUP', label: 'Group' },
  { value: 'DISCOUNT', label: 'Discount' },
  { value: 'PAYMENT', label: 'Payment' },
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
  const unit = typeof params.unit === 'string' ? params.unit : undefined
  const categoryId = typeof params.category === 'string' ? params.category : undefined
  const includeInactive = params.archived === '1'
  const sort = readSort(params, SORTABLE, { sort: 'type', dir: 'asc' })
  const linkParams = {
    q: query.q,
    type,
    unit,
    category: categoryId,
    archived: includeInactive ? '1' : undefined,
    sort: sort.sort,
    dir: sort.dir,
  }

  const [page, units, accounts, taxCodes, categories, shelf, catalogItems] = await Promise.all([
    itemService.list(ctx, query, { type, unit, categoryId, includeInactive, ...sort }),
    itemService.listUnits(ctx),
    accountService.selectableAccounts(ctx),
    taxService.listCodes(ctx),
    itemService.listCategories(ctx),
    storeService.quantities(ctx),
    itemService.listCatalog(ctx),
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
  const taxOptions = ctx.features.enableTax
    ? taxCodes.filter((c) => c.isActive).map((c) => ({ id: c.id, label: c.name }))
    : []
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
      catalogItems={catalogItems}
      currency={ctx.organization.baseCurrency}
      today={today(ctx.organization.timeZone)}
    />
  ) : undefined

  return (
    <>
      <PageHeader
        title="Products and services"
        description="Everything the business sells, with what is on hand beside it. Filter by category, turn on store columns in the table, or open Categories for a shelf view per group."
        actions={
          <>
            <Link href="/items/categories" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Categories
            </Link>
            {canCreate ? <ImportDialog kind="item" columns={ITEM_COLUMNS} /> : null}
            {newButton}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder="Search name, SKU, barcode or description"
          className="max-w-2xl"
        />
        <ItemFilters types={TYPE_FILTERS} units={units} />
        <Link
          href={itemsQuery({
            type,
            unit,
            category: categoryId,
            q: query.q,
            archived: includeInactive ? undefined : '1',
          })}
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

      {categories.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Link
            href={itemsQuery({ type, unit, archived: includeInactive ? '1' : undefined, q: query.q })}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
              !categoryId ? 'border-primary bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            All categories
          </Link>
          {categories.map((category) => {
            const active = categoryId === category.id
            const href = itemsQuery({
              type,
              unit,
              category: category.id,
              archived: includeInactive ? '1' : undefined,
              q: query.q,
            })
            return (
              <Link
                key={category.id}
                href={href}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                  active ? 'border-primary bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {category.name}
              </Link>
            )
          })}
        </div>
      ) : null}

      {page.total === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title={query.q || type || unit || categoryId ? 'No items match' : 'No products or services yet'}
          description={
            query.q || type || unit || categoryId
              ? 'Try a different search or filter.'
              : 'Add what the business sells. An inventory item also needs a stock account and a cost of goods sold account, so selling one moves both in the same journal as the sale.'
          }
          action={!query.q && !type && !unit && !categoryId ? newButton : undefined}
        />
      ) : (
        <Card className="overflow-hidden p-0">
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
              catalogItems={catalogItems}
              currency={ctx.organization.baseCurrency}
              canEdit={ctx.permissions.has('item:update')}
              canArchive={ctx.permissions.has('item:archive')}
              canDelete={
                ctx.permissions.has('item:delete') && ctx.features.allowItemDelete
              }
              canAdjust={ctx.permissions.has('inventory:adjust')}
              startEditingId={editId}
              extraEdit={
                extraEdit
                  ? { ...extraEdit, onHand: null, stockValue: null, averageCost: null, belowReorder: false }
                  : null
              }
            />
          <Pagination total={page.total} />
        </Card>
      )}
    </>
  )
}
