import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { StoreForm } from '@/components/inventory/store-form'
import { buttonVariants } from '@/components/ui/button'
import { requireOrgContext } from '@/server/auth/context'
import * as storeService from '@/server/services/store.service'

export const metadata: Metadata = { title: 'New store' }

export default async function NewStorePage() {
  const ctx = await requireOrgContext('account:create')
  const office = await storeService.officeId(ctx)

  return (
    <>
      <PageHeader
        title="New store"
        description="Register the store: address, phone, and who holds the key. An inventory account is created with it."
        actions={
          <Link
            href={office ? `/stores/${office}` : '/stores'}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Back to stores
          </Link>
        }
      />
      <StoreForm cancelHref={office ? `/stores/${office}` : '/stores'} />
    </>
  )
}
