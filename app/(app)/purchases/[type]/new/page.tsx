import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { BillForm } from '@/components/purchases/bill-form'
import { today } from '@/lib/date'
import { purchaseBySlug } from '@/lib/purchase-types'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import { loadPurchaseOptions } from '@/server/services/purchase-options'
import * as storeService from '@/server/services/store.service'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>
}): Promise<Metadata> {
  return { title: `New ${purchaseBySlug((await params).type)?.singular.toLowerCase() ?? 'document'}` }
}

export default async function NewPurchasePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const config = purchaseBySlug((await params).type)
  if (!config) notFound()

  const ctx = await requireOrgContext('bill:create')
  const vendorParam = (await searchParams).vendor
  const requestedVendor = typeof vendorParam === 'string' ? vendorParam : undefined
  const [options, documentNumber, shelf] = await Promise.all([
    loadPurchaseOptions(ctx),
    peekDocumentNumber(db, ctx.orgId, config.type),
    storeService.quantities(ctx),
  ])
  const initialVendorId = options.vendors.some((vendor) => vendor.id === requestedVendor)
    ? requestedVendor
    : undefined

  return (
    <>

      <PageHeader title={`New ${config.singular.toLowerCase()}`} description={config.effect} />

      <BillForm
        config={config}
        vendors={options.vendors}
        items={options.items}
        taxCodes={options.taxCodes}
        paymentAccounts={options.paymentAccounts}
        expenseAccounts={options.expenseAccounts}
        terms={options.terms.map((term) => ({
          id: term.id,
          label: term.name,
          type: term.type,
          dueDays: term.dueDays,
        }))}
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        documentNumber={documentNumber}
        initialVendorId={initialVendorId}
        stores={shelf.stores}
        stock={shelf.byItem}
      />
    </>
  )
}
