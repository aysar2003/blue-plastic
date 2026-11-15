import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { DocumentForm } from '@/components/sales/document-form'
import { SalesPaperFrame } from '@/components/sales/paper-width'
import { today } from '@/lib/date'
import { bySlug } from '@/lib/sales-types'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import { loadFormCustomization } from '@/server/services/form-customization'
import { loadFormOptions } from '@/server/services/sales-options'
import * as projectService from '@/server/services/project.service'
import * as salesService from '@/server/services/sales.service'
import * as storeService from '@/server/services/store.service'
import * as trackingCategories from '@/server/services/tracking-category.service'

/** Form options + stock for a large catalogue exceed the default 10s hobby limit. */
export const maxDuration = 60

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>
}): Promise<Metadata> {
  const config = bySlug((await params).type)
  return { title: `New ${config?.singular.toLowerCase() ?? 'document'}` }
}

export default async function NewSalesDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const config = bySlug((await params).type)
  if (!config) notFound()

  const ctx = await requireOrgContext(config.createPermission)
  const loadsSources = config.type === 'INVOICE' || config.type === 'SALES_RECEIPT'
  const emptyShelf = {
    stores: [] as Awaited<ReturnType<typeof storeService.quantities>>['stores'],
    byItem: {} as Awaited<ReturnType<typeof storeService.quantities>>['byItem'],
  }
  const query = await searchParams
  const copyId = typeof query.copy === 'string' ? query.copy : undefined
  const copySource = copyId ? await salesService.get(ctx, copyId).catch(() => null) : null
  if (copyId && (!copySource || copySource.type !== config.type)) notFound()

  const calendarToday = today(ctx.organization.timeZone)
  const requestedProject = typeof query.project === 'string' ? query.project : undefined
  const project = requestedProject
    ? await projectService.peek(ctx, requestedProject).catch(() => null)
    : null
  const requested = typeof query.customer === 'string' ? query.customer : project?.customerId
  const ensureCustomerIds = [
    ...(requested ? [requested] : []),
    ...(copySource?.customer.id ? [copySource.customer.id] : []),
  ]
  const ensureItemIds = (copySource?.lines ?? [])
    .map((line) => line.item?.id)
    .filter((id): id is string => Boolean(id))

  const [options, documentNumber, neighbors, shelf, openSources, formCustomization, classes] =
    await Promise.all([
      loadFormOptions(ctx, {
        includeOnHand: false,
        ensureCustomerIds,
        ensureItemIds,
      }),
      peekDocumentNumber(db, ctx.orgId, config.type),
      salesService.neighbors(ctx, config.type, null),
      storeService.quantities(ctx).catch(() => emptyShelf),
      loadsSources ? salesService.listConvertibleSources(ctx) : Promise.resolve([]),
      loadFormCustomization(ctx, 'sales', config.type),
      trackingCategories.list(ctx),
    ])
  const initialCustomerId = options.customers.some((customer) => customer.id === requested)
    ? requested
    : undefined
  const requestedStore = typeof query.store === 'string' ? query.store : undefined
  const initialStoreId = shelf.stores.some((store) => store.id === requestedStore)
    ? requestedStore
    : undefined

  const copySeed = copySource
    ? {
        customerId: copySource.customer.id,
        date: calendarToday,
        reference: copySource.reference,
        inRef: copySource.inRef,
        prescriptionRef: copySource.prescriptionRef,
        memo: copySource.memo,
        customerMessage: copySource.customerMessage,
        workScope: copySource.workScope,
        workSite: copySource.workSite,
        paymentTermId: copySource.paymentTerm?.id ?? null,
        depositAccountId: copySource.depositAccount?.id ?? null,
        paymentMethod: copySource.paymentMethod,
        projectId: copySource.projectId ?? null,
        trackingCategoryId: copySource.trackingCategoryId ?? null,
        discountAmount: copySource.discountAmount,
        currencyCode: copySource.currencyCode,
        exchangeRate: copySource.exchangeRate?.toString() ?? '1',
        lines: copySource.lines.map((line) => ({
          itemId: line.item?.id ?? null,
          description: line.description,
          quantity: line.quantity.toString(),
          unitPrice: line.unitPrice.toString(),
          discountPercent: line.discountPercent?.toString() ?? null,
          taxCodeId: line.taxCode?.id ?? null,
          storeId: line.storeId,
          lotNumber: null,
          serialNumber: null,
          lotExpiryDate: null,
        })),
      }
    : undefined

  return (
    <SalesPaperFrame type={config.type}>
      <PageHeader
        title={
          copySource
            ? `Copy ${config.singular.toLowerCase()} ${copySource.number}`
            : `New ${config.singular.toLowerCase()}`
        }
        className="mb-2 pb-2"
      />

      <DocumentForm
        config={config}
        customers={options.customers}
        items={options.items}
        taxCodes={options.taxCodes}
        depositAccounts={options.depositAccounts}
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
        initialCustomerId={copySeed ? undefined : initialCustomerId}
        initialStoreId={initialStoreId}
        initialProjectId={copySeed ? undefined : project?.id}
        initialWorkSite={copySeed ? undefined : (project?.siteLocation ?? undefined)}
        projects={options.projects}
        classes={classes.map((row) => ({ id: row.id, label: row.name }))}
        neighbors={neighbors}
        stores={shelf.stores}
        stock={shelf.byItem}
        openSources={openSources}
        formCustomization={formCustomization}
        canEmail={ctx.permissions.has('invoice:send')}
      />
    </SalesPaperFrame>
  )
}
