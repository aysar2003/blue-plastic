import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { StoreForm } from '@/components/inventory/store-form'
import { buttonVariants } from '@/components/ui/button'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export const metadata: Metadata = { title: 'Edit store' }

export default async function EditStorePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext('account:create')
  const { id } = await params
  const store = await db.store.findFirst({
    where: { id, orgId: ctx.orgId, isActive: true },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      keyHolderName: true,
      keyHolderPhone: true,
      notes: true,
    },
  })
  if (!store) notFound()

  return (
    <>
      <PageHeader
        title={`Edit ${store.name}`}
        description="Update address, phone, and who holds the store key."
        actions={
          <Link href={`/stores/${id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Back to store
          </Link>
        }
      />
      <StoreForm mode="edit" initial={store} cancelHref={`/stores/${id}`} />
    </>
  )
}
