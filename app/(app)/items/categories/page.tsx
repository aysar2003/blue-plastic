import type { Metadata } from 'next'
import Link from 'next/link'
import { FolderOpenIcon, PackageIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { requireOrgContext } from '@/server/auth/context'
import * as itemService from '@/server/services/item.service'

export const metadata: Metadata = { title: 'Product categories' }

export default async function ItemCategoriesPage() {
  const ctx = await requireOrgContext('item:read')
  const categories = await itemService.categoryDashboard(ctx)
  const canCreate = ctx.permissions.has('item:create')

  return (
    <>
      <PageHeader
        title="Product categories"
        description="Standard merchandise groups — building materials, plumbing, electrical, electronics, and the rest. Open a category to see its items and stock in every store."
        actions={
          <Link href="/items" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            All products
          </Link>
        }
      />

      {categories.length === 0 ? (
        <EmptyState
          icon={FolderOpenIcon}
          title="No categories yet"
          description="Categories appear when you add products, or when the standard catalogue is seeded."
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
          Assign a category on each product. New organisations get the international standard list
          automatically.
        </p>
      ) : null}
    </>
  )
}
