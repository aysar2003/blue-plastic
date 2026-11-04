import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as assetService from '@/server/services/fixed-asset.service'

import { NewAssetForm } from './new-asset-form'

export const metadata: Metadata = { title: 'New fixed asset' }

export default async function NewFixedAssetPage() {
  const ctx = await requireOrgContext('journal:post')
  const categories = await assetService.listCategories(ctx)
  if (categories.length === 0) {
    redirect('/accounting/fixed-assets/categories')
  }

  return (
    <>
      <PageHeader
        title="New fixed asset"
        description="Cost and life drive the monthly depreciation run."
        actions={
          <Link href="/accounting/fixed-assets" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Cancel
          </Link>
        }
      />
      <Card className="max-w-lg p-4">
        <NewAssetForm categories={categories} today={today(ctx.organization.timeZone)} />
      </Card>
    </>
  )
}
