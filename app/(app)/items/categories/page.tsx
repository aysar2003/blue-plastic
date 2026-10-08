import type { Metadata } from 'next'
import Link from 'next/link'
import { FolderOpenIcon, PackageIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { StandardCategoriesButton } from '@/components/master-data/standard-categories-button'
import { requireOrgContext } from '@/server/auth/context'
import * as itemService from '@/server/services/item.service'

export const metadata: Metadata = { title: 'Product categories' }

export default async function ItemCategoriesPage() {
  const ctx = await requireOrgContext('item:read')
  const canSeed = ctx.permissions.has('item:update')
  const [categories, missing] = await Promise.all([
    itemService.categoryDashboard(ctx),
    canSeed ? itemService.missingStandardCategories(ctx) : Promise.resolve([] as string[]),
  ])
  const canCreate = ctx.permissions.has('item:create')

  return (
    <>
      <PageHeader
        title="Product categories"
        description="Standard merchandise groups — building materials, plumbing, electrical, electronics, and the rest. Open a category to see its items and stock in every store."
        actions={
          <>
            {canSeed && missing.length > 0 ? <StandardCategoriesButton missing={missing.length} /> : null}
            <Link href="/items" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              All products
            </Link>
          </>
        }
      />

      {categories.length === 0 ? (
        <EmptyState
          icon={FolderOpenIcon}
          title="No categories yet"
          description={
            canSeed
              ? 'Add the standard catalogue (building materials, plumbing, electrical, …) with the button above, or create categories from the product form.'
              : 'Categories appear when someone adds them from the product form.'
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((category) => (
            <Link key={category.id} href={`/items/categories/${category.id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  <CardDescription>
                    {category.itemCount === 0
                      ? 'No items yet'
                      : `${category.itemCount} item${category.itemCount === 1 ? '' : 's'}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-2 text-xs text-muted-foreground">
                  <PackageIcon className="size-3.5" />
                  Open shelf
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {canCreate ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Assign a category on each product. The standard list can be added in one step with
          Add standard categories.
        </p>
      ) : null}
    </>
  )
}
