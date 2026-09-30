import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'

import { PageHeader } from '@/components/data/page-header'
import { DocumentForm } from '@/components/sales/document-form'
import { buttonVariants } from '@/components/ui/button'
import { toCalendarDate, today } from '@/lib/date'
import { describeTerm } from '@/lib/payment-terms'
import { bySlug } from '@/lib/sales-types'
import { requireOrgContext } from '@/server/auth/context'
import { loadFormOptions } from '@/server/services/sales-options'
import * as salesService from '@/server/services/sales.service'

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
  const [document, options] = await Promise.all([
    salesService.get(ctx, id),
    loadFormOptions(ctx),
  ])

  if (document.type !== config.type) notFound()

  return (
    <>
      <Link
        href={`/sales/${config.slug}/${id}`}
        className={`${buttonVariants({ variant: 'ghost', size: 'sm' })} mb-3 -ml-2`}
      >
        <ArrowLeftIcon /> {config.singular} {document.number}
      </Link>

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
        terms={options.terms.map((term) => ({ id: term.id, label: `${term.name} — ${describeTerm(term)}` }))}
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        organizationName={ctx.organization.name}
        document={{
          id: document.id,
          customerId: document.customer.id,
          date: toCalendarDate(document.date),
          reference: document.reference,
          memo: document.memo,
          customerMessage: document.customerMessage,
          paymentTermId: document.paymentTerm?.id ?? null,
          depositAccountId: document.depositAccount?.id ?? null,
          lines: document.lines.map((line) => ({
            itemId: line.item?.id ?? null,
            description: line.description,
            quantity: line.quantity.toString(),
            unitPrice: line.unitPrice.toString(),
            discountPercent: line.discountPercent?.toString() ?? null,
            taxCodeId: line.taxCode?.id ?? null,
          })),
        }}
      />
    </>
  )
}
