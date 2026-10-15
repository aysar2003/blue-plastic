import type { Metadata } from 'next'
import Link from 'next/link'
import { FolderOpenIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import {
  CategoryBoard,
  NewCategoryButton,
} from '@/components/master-data/category-board'
import { StandardCategoriesButton } from '@/components/master-data/standard-categories-button'
import { requireOrgContext } from '@/server/auth/context'
import * as itemService from '@/server/services/item.service'

export const metadata: Metadata = { title: 'Product categories' }

export default async function ItemCategoriesPage() {
  const ctx = await requireOrgContext('item:read')
  const canManage = ctx.permissions.has('item:update')
  const [categories, missing] = await Promise.all([
    itemService.categoryDashboard(ctx),
    canManage ? itemService.missingStandardCategories(ctx) : Promise.resolve([] as string[]),
  ])

  return (
    <>
      <PageHeader
        title="Product categories"
        description="Standard merchandise groups — building materials, plumbing, electrical, electronics, and the rest. Open a category to see its items and stock cost."
        actions={
          <>
            {canManage ? <NewCategoryButton existingNames={categories.map((row) => row.name)} /> : null}
            {canManage && missing.length > 0 ? (
              <StandardCategoriesButton missing={missing.length} />
            ) : null}
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
            canManage
              ? 'Add a custom category, pick from the prepared list, or load the standard catalogue with the button above.'
              : 'Categories appear when someone adds them from the product form.'
          }
          action={
            canManage ? (
              <NewCategoryButton existingNames={[]} />
            ) : undefined
          }
        />
      ) : (
        <CategoryBoard
          categories={categories}
          currency={ctx.organization.baseCurrency}
          canManage={canManage}
        />
      )}

      {canManage ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Create a category from the prepared list or with your own name. Empty categories
          can be deleted; groups that still hold items stay locked until those products move.
        </p>
      ) : null}
    </>
  )
}
