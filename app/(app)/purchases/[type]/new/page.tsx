import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { BillForm } from '@/components/purchases/bill-form'
import { today } from '@/lib/date'
import { purchaseBySlug } from '@/lib/purchase-types'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import { loadFormCustomization } from '@/server/services/form-customization'
import { loadPurchaseOptions } from '@/server/services/purchase-options'
import * as projectService from '@/server/services/project.service'
import * as purchaseService from '@/server/services/purchase.service'
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
  const query = await searchParams
  const vendorParam = query.vendor
  const requestedVendor = typeof vendorParam === 'string' ? vendorParam : undefined
  const requestedProject = typeof query.project === 'string' ? query.project : undefined
  const emptyShelf = { stores: [] as Awaited<ReturnType<typeof storeService.quantities>>['stores'], byItem: {} as Awaited<ReturnType<typeof storeService.quantities>>['byItem'] }
  const [options, documentNumber, neighbors, shelf, project, formCustomization] = await Promise.all([
    loadPurchaseOptions(ctx),
    peekDocumentNumber(db, ctx.orgId, config.type),
    purchaseService.neighbors(ctx, config.type, null),
    // Stock is helpful but must not block creating a bill if the pool is busy.
    storeService.quantities(ctx).catch(() => emptyShelf),
    requestedProject
      ? projectService.peek(ctx, requestedProject).catch(() => null)
      : Promise.resolve(null),
    loadFormCustomization(ctx, 'purchase', config.type),
  ])
  const initialVendorId = options.vendors.some((vendor) => vendor.id === requestedVendor)
    ? requestedVendor
    : undefined

  return (
    <>
      <PageHeader title={`New ${config.singular.toLowerCase()}`} className="mb-2 pb-2" />

      <BillForm
        config={config}
        vendors={options.vendors}
        customers={options.customers}
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
        initialProjectId={project?.id}
        projects={options.projects}
        neighbors={neighbors}
        stores={shelf.stores}
        stock={shelf.byItem}
        formCustomization={formCustomization}
      />
    </>
  )
}
