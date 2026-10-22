import { notFound } from 'next/navigation'

import { DocumentActions } from '@/components/print/document-actions'
import { longDate } from '@/components/sales/invoice-sheet'
import { MerchantInvoice } from '@/components/sales/merchant-invoice'
import { toCalendarDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { purchaseBySlug } from '@/lib/purchase-types'
import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'
import * as purchaseService from '@/server/services/purchase.service'

export const metadata = { title: 'Print' }

const VENDOR_WORDS = {
  party: 'Vendor',
  account: 'Vendor account',
  date: 'Bill date',
  person: 'Entered by',
  reference: 'Vendor ref',
  order: 'Reference',
}

/**
 * Vendor-facing bill, expense, credit, or purchase order on the same paper as
 * a sales invoice. Print from the browser; PDF is the matching download route.
 */
export default async function PrintPurchasePage({
  params,
}: {
  params: Promise<{ type: string; id: string }>
}) {
  const { type, id } = await params
  const config = purchaseBySlug(type)
  if (!config) notFound()

  const ctx = await requireOrgContext('bill:read')
  const [rows, organization, template] = await Promise.all([
    purchaseService.getMany(ctx, [id]),
    organizationService.get(ctx),
    organizationService.getDocumentTemplate(ctx),
  ])
  const document = rows[0]
  if (!document || document.type !== config.type) notFound()

  const currency = document.currencyCode || ctx.organization.baseCurrency
  const vendor = document.customer
  const money = (value: string | number) => formatMoney(value, currency)

  const shareBody = [
    `${config.singular} ${document.number}`,
    `Vendor: ${vendor.displayName}`,
    `Date: ${longDate(toCalendarDate(document.date), document.createdAt, organization.timeZone)}`,
    `Total: ${money(document.total)}`,
    document.balance && Number(document.balance) > 0 ? `Amount due: ${money(document.balance)}` : null,
    '',
    `From ${organization.legalName ?? organization.name}`,
  ]
    .filter((line) => line !== null)
    .join('\n')

  const filename = `${config.slug.replace(/s$/, '')}-${document.number
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}.pdf`

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <DocumentActions
          paper={config.singular.toLowerCase()}
          backHref={`/purchases/${config.slug}/${id}`}
          pdfHref={`/api/purchases/${id}/pdf`}
          filename={filename}
          pdfMatchesPrint
          defaultTo={vendor.email ?? ''}
          defaultSubject={`${config.singular} ${document.number} from ${organization.name}`}
          defaultBody={shareBody}
          whatsappPhone={vendor.phone}
          whatsappText={shareBody}
        />
      </div>

      <MerchantInvoice
        document={document}
        organization={organization}
        template={template}
        config={config}
        baseCurrency={ctx.organization.baseCurrency}
        printedBy={ctx.user.name}
        words={VENDOR_WORDS}
      />
    </div>
  )
}
