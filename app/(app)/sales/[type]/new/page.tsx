import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { DocumentForm } from '@/components/sales/document-form'
import { today } from '@/lib/date'
import { bySlug } from '@/lib/sales-types'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import { loadFormOptions } from '@/server/services/sales-options'
import * as salesService from '@/server/services/sales.service'
import * as storeService from '@/server/services/store.service'

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
  const [options, query, documentNumber, neighbors, shelf, openQuotations] = await Promise.all([
    loadFormOptions(ctx),
    searchParams,
    peekDocumentNumber(db, ctx.orgId, config.type),
    config.type === 'SALES_RECEIPT' ? salesService.neighbors(ctx, config.type, null) : Promise.resolve(undefined),
    storeService.quantities(ctx),
    config.type === 'INVOICE' ? salesService.listConvertibleEstimates(ctx) : Promise.resolve([]),
  ])
  const requested = typeof query.customer === 'string' ? query.customer : undefined
  const initialCustomerId = options.customers.some((customer) => customer.id === requested)
    ? requested
    : undefined

  return (
    <>

      <PageHeader
        title={`New ${config.singular.toLowerCase()}`}
        description={
          config.type === 'INVOICE'
            ? 'Start a blank invoice, or pick an open quotation to reuse its items and prices.'
            : config.effect
        }
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
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        organizationName={ctx.organization.name}
        documentNumber={documentNumber}
        initialCustomerId={initialCustomerId}
        neighbors={neighbors}
        stores={shelf.stores}
        stock={shelf.byItem}
        openQuotations={openQuotations}
      />
    </>
  )
}
