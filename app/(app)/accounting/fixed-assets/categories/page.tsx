import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as assetService from '@/server/services/fixed-asset.service'

import { CategoryForm } from './category-form'

export const metadata: Metadata = { title: 'Asset categories' }

export default async function FixedAssetCategoriesPage() {
  const ctx = await requireOrgContext('journal:post')
  const [categories, accounts] = await Promise.all([
    assetService.listCategories(ctx),
    db.ledgerAccount.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, code: true, name: true, type: true },
      orderBy: { code: 'asc' },
    }),
  ])

  return (
    <>
      <PageHeader
        title="Asset categories"
        description="Map cost, accumulated depreciation, and expense accounts for each class of asset."
        actions={
          <Link href="/accounting/fixed-assets" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Back to assets
          </Link>
        }
      />
      <Card className="mb-6 max-w-lg p-4">
        <CategoryForm accounts={accounts} />
      </Card>
      <ul className="space-y-2 text-sm">
        {categories.map((row) => (
          <li key={row.id} className="rounded-md border px-3 py-2">
            <span className="font-medium">{row.name}</span>
            <span className="text-muted-foreground"> · {row.usefulLifeMonths} months</span>
          </li>
        ))}
      </ul>
    </>
  )
}
