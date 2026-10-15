import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PackageIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { MetricCard } from '@/components/data/metric-card'
import { PageHeader } from '@/components/data/page-header'
import { Pagination } from '@/components/data/pagination'
import { SearchInput } from '@/components/data/search-input'
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { today } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { parseListQuery } from '@/lib/validation/common'
import { readSort } from '@/components/data/sortable-header'
import { requireOrgContext } from '@/server/auth/context'
import * as accountService from '@/server/services/account.service'
import { trailsFor } from '@/server/services/audit.service'
import * as itemService from '@/server/services/item.service'
import * as storeService from '@/server/services/store.service'
import * as taxService from '@/server/services/tax.service'
import { whoText } from '@/components/data/recorded-by'
import { ItemTable } from '../../item-table'

const SORTABLE = ['name', 'type', 'price', 'cost', 'sku'] as const

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  try {
    const ctx = await requireOrgContext('item:read')
    const category = await itemService.getCategory(ctx, (await params).id)
    return { title: category.name }
  } catch {
    return { title: 'Category' }
  }
}

export default async function ItemCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('item:read')
  const { id } = await params
  const queryParams = await searchParams
  const query = parseListQuery(queryParams)
  const sort = readSort(queryParams, SORTABLE, { sort: 'name', dir: 'asc' })

  let shelf: Awaited<ReturnType<typeof itemService.categoryShelf>>
  try {
    shelf = await itemService.categoryShelf(ctx, id)
  } catch {
    notFound()
  }

  const linkParams = {
    q: query.q,
    sort: sort.sort,
    dir: sort.dir,
  }

  const [page, accounts, taxCodes, categories, storeShelf] = await Promise.all([
    itemService.list(ctx, query, { categoryId: id, ...sort }),
    accountService.selectableAccounts(ctx),
    taxService.listCodes(ctx),
    itemService.listCategories(ctx),
    storeService.quantities(ctx),
  ])

  const trails = await trailsFor(
    ctx,
    page.rows.map((row) => row.id),
  )
  const currency = ctx.organization.baseCurrency
  const taxOptions = ctx.features.enableTax
    ? taxCodes.filter((c) => c.isActive).map((c) => ({ id: c.id, label: c.name }))
    : []
  const categoryOptions = categories.map((c) => ({ id: c.id, label: c.name }))
  const storeOptions = storeShelf.stores.map((store) => ({
    id: store.id,
    label: store.name,
    isOffice: store.isOffice,
  }))

  return (
    <>
      <PageHeader
        title={shelf.name}
        description="Category dashboard — items in this group, on-hand quantity, and stock cost across stores."
        actions={
          <>
            <Link href="/items/categories" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              All categories
            </Link>
            <Link href={`/items?category=${shelf.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              In products list
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Items" value={shelf.itemCount} />
        <MetricCard label="On hand" value={shelf.onHand} />
        <MetricCard
          label="Total cost"
          value={formatMoney(shelf.totalCost, currency)}
        />
        <MetricCard
          label="Showing"
          value={page.total}
          hint={query.q ? 'Matching this search' : 'In this category'}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search in this category" />
      </div>

      {page.total === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title={query.q ? 'No items match' : 'Nothing in this category yet'}
          description={
            query.q
              ? 'Try a different search.'
              : 'Open a product and set its category, or create a new item assigned here.'
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ItemTable
            sort={sort}
            linkParams={linkParams}
            storeColumns={storeShelf.stores}
            rows={page.rows.map((row) => ({
              ...row,
              recorded: whoText(trails.get(row.id)),
              storeQty: storeShelf.byItem[row.id] ?? {},
            }))}
            accounts={accounts}
            taxCodes={taxOptions}
            categories={categoryOptions}
            stores={storeOptions}
            currency={currency}
            canEdit={ctx.permissions.has('item:update')}
            canArchive={ctx.permissions.has('item:archive')}
            canAdjust={ctx.permissions.has('inventory:adjust')}
            startEditingId={undefined}
            extraEdit={null}
          />
          <Pagination total={page.total} />
        </Card>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        As of {today(ctx.organization.timeZone)}. Stock columns use live store quantities;
        total cost is inventory value at average cost.
      </p>
    </>
  )
}
