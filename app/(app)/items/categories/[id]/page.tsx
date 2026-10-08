import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PackageIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Pagination } from '@/components/data/pagination'
import { SearchInput } from '@/components/data/search-input'
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { today } from '@/lib/date'
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

  let category: Awaited<ReturnType<typeof itemService.getCategory>>
  try {
    category = await itemService.getCategory(ctx, id)
  } catch {
    notFound()
  }

  const linkParams = {
    q: query.q,
    sort: sort.sort,
    dir: sort.dir,
  }

  const [page, accounts, taxCodes, categories, shelf] = await Promise.all([
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
  const taxOptions = taxCodes.filter((c) => c.isActive).map((c) => ({ id: c.id, label: c.name }))
  const categoryOptions = categories.map((c) => ({ id: c.id, label: c.name }))
  const storeOptions = shelf.stores.map((store) => ({
    id: store.id,
    label: store.name,
    isOffice: store.isOffice,
  }))

  return (
    <>
      <PageHeader
        title={category.name}
        description="Items in this category, with on-hand quantity and a column for each store. Turn store columns on in the table customize menu if they are hidden."
        actions={
          <>
            <Link href="/items/categories" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              All categories
            </Link>
            <Link href={`/items?category=${category.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              In products list
            </Link>
          </>
        }
      />

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
            startEditingId={undefined}
            extraEdit={null}
          />
          <Pagination total={page.total} />
        </Card>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        As of {today(ctx.organization.timeZone)}. Stock columns use live store quantities.
      </p>
    </>
  )
}
