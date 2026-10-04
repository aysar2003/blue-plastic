import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { DocumentForm } from '@/components/sales/document-form'
import { toCalendarDate, today } from '@/lib/date'
import { bySlug } from '@/lib/sales-types'
import { requireOrgContext } from '@/server/auth/context'
import { loadFormOptions } from '@/server/services/sales-options'
import * as salesService from '@/server/services/sales.service'
import * as storeService from '@/server/services/store.service'

export const metadata: Metadata = { title: 'Edit document' }

/**
 * Editing a posted document.
 *
 * The document is mutable; its journal is not. Saving reverses the existing
 * journal and posts a new one, leaving both on the record (ADR-0002) — so this
 * is an ordinary edit screen with an extraordinary audit trail behind it.
 *
 * A voided document, or one with payments applied, is refused by the service.
 * The detail screen hides the button in those cases, but the rule lives there,
 * not here.
 */
export default async function EditSalesDocumentPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>
}) {
  const { type, id } = await params
  const config = bySlug(type)
  if (!config) notFound()

  const ctx = await requireOrgContext('invoice:update')
  const [document, options, neighbors, shelf] = await Promise.all([
    salesService.get(ctx, id),
    loadFormOptions(ctx),
    config.type === 'SALES_RECEIPT' ? salesService.neighbors(ctx, config.type, id) : Promise.resolve(undefined),
    storeService.quantities(ctx),
  ])

  if (document.type !== config.type) notFound()

  return (
    <>

      <PageHeader
        title={`Edit ${config.singular.toLowerCase()} ${document.number}`}
        description="Saving reverses the original entry and posts a replacement. Both stay in the ledger."
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
        documentNumber={document.number}
        document={{
          id: document.id,
          customerId: document.customer.id,
          date: toCalendarDate(document.date),
          reference: document.reference,
          memo: document.memo,
          customerMessage: document.customerMessage,
          paymentTermId: document.paymentTerm?.id ?? null,
          depositAccountId: document.depositAccount?.id ?? null,
          discountAmount: document.discountAmount,
          lines: document.lines.map((line) => ({
            itemId: line.item?.id ?? null,
            description: line.description,
            quantity: line.quantity.toString(),
            unitPrice: line.unitPrice.toString(),
            discountPercent: line.discountPercent?.toString() ?? null,
            taxCodeId: line.taxCode?.id ?? null,
            storeId: line.storeId,
          })),
        }}
        neighbors={neighbors}
        stores={shelf.stores}
        stock={shelf.byItem}
      />
    </>
  )
}
