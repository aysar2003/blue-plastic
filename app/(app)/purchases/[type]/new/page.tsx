import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { BillForm } from '@/components/purchases/bill-form'
import { SalesPaperFrame } from '@/components/sales/paper-width'
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
import * as trackingCategories from '@/server/services/tracking-category.service'

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
  const copyId = typeof query.copy === 'string' ? query.copy : undefined
  const emptyShelf = {
    stores: [] as Awaited<ReturnType<typeof storeService.quantities>>['stores'],
    byItem: {} as Awaited<ReturnType<typeof storeService.quantities>>['byItem'],
  }
  const copySource = copyId ? await purchaseService.get(ctx, copyId).catch(() => null) : null
  if (copyId && (!copySource || copySource.type !== config.type)) notFound()

  const project = requestedProject
    ? await projectService.peek(ctx, requestedProject).catch(() => null)
    : null

  const ensureVendorIds = [
    ...(requestedVendor ? [requestedVendor] : []),
    ...(copySource?.vendor?.id ? [copySource.vendor.id] : []),
  ]
  const ensureCustomerIds = [
    ...(copySource?.offsetCustomer?.id ? [copySource.offsetCustomer.id] : []),
    ...((copySource?.lines ?? [])
      .map((line) => line.billableCustomerId)
      .filter((id): id is string => Boolean(id))),
  ]
  const ensureItemIds = (copySource?.lines ?? [])
    .map((line) => line.item?.id)
    .filter((id): id is string => Boolean(id))

  const [options, documentNumber, neighbors, shelf, formCustomization, classes] = await Promise.all([
    loadPurchaseOptions(ctx, { ensureVendorIds, ensureCustomerIds, ensureItemIds }),
    peekDocumentNumber(db, ctx.orgId, config.type),
    purchaseService.neighbors(ctx, config.type, null),
    storeService.quantities(ctx).catch(() => emptyShelf),
    loadFormCustomization(ctx, 'purchase', config.type),
    trackingCategories.list(ctx),
  ])

  const calendarToday = today(ctx.organization.timeZone)
  const initialVendorId = options.vendors.some((vendor) => vendor.id === requestedVendor)
    ? requestedVendor
    : undefined

  const copySeed = copySource
    ? {
        vendorId: copySource.vendor?.id ?? '',
        date: calendarToday,
        reference: copySource.reference,
        inRef: copySource.inRef,
        memo: copySource.memo,
        paymentTermId: copySource.paymentTerm?.id ?? null,
        paymentAccountId: copySource.paymentAccount?.id ?? null,
        offsetCustomerId: copySource.offsetCustomer?.id ?? null,
        projectId: copySource.projectId ?? null,
        trackingCategoryId: copySource.trackingCategoryId ?? null,
        lines: copySource.lines.map((line) => ({
          itemId: line.item?.id ?? null,
          expenseAccountId: line.expenseAccount?.id ?? null,
          description: line.description,
          quantity: line.quantity.toString(),
          unitPrice: line.unitPrice.toString(),
          taxCodeId: line.taxCode?.id ?? null,
          storeId: line.storeId,
          billableCustomerId: line.billableCustomerId,
          billableUnitPrice: line.billableUnitPrice,
        })),
      }
    : undefined

  return (
    <SalesPaperFrame>
      <PageHeader
        title={
          copySource
            ? `Copy ${config.singular.toLowerCase()} ${copySource.number}`
            : `New ${config.singular.toLowerCase()}`
        }
        className="mb-2 pb-2"
      />

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
        today={calendarToday}
        currency={ctx.organization.baseCurrency}
        organizationName={ctx.organization.name}
        documentNumber={documentNumber}
        document={copySeed}
        copiedFromNumber={copySource?.number}
        initialVendorId={copySeed ? undefined : initialVendorId}
        initialProjectId={copySeed ? undefined : project?.id}
        projects={options.projects}
        classes={classes.map((row) => ({ id: row.id, label: row.name }))}
        neighbors={neighbors}
        stores={shelf.stores}
        stock={shelf.byItem}
        formCustomization={formCustomization}
        canEmail={ctx.permissions.has('invoice:send')}
      />
    </SalesPaperFrame>
  )
}
