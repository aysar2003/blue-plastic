import { notFound } from 'next/navigation'

import { toCalendarDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { bySlug } from '@/lib/sales-types'
import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'
import * as salesService from '@/server/services/sales.service'
import { longDate } from '@/components/sales/invoice-sheet'
import { MerchantInvoice } from '@/components/sales/merchant-invoice'
import { PrintButton } from './print-button'

export const metadata = { title: 'Print' }

/**
 * The customer-facing document, in the sales sheet style: the business name
 * at the top right, a navy line table, and the totals stacked beneath it.
 *
 * Printed by the browser. Saving as PDF is the same dialog, so the layout
 * stays in CSS.
 */
export default async function PrintDocumentPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>
}) {
  const { type, id } = await params
  const config = bySlug(type)
  if (!config) notFound()

  const ctx = await requireOrgContext('invoice:read')
  const [document, organization, template] = await Promise.all([
    salesService.get(ctx, id).catch(() => null),
    organizationService.get(ctx),
    organizationService.getDocumentTemplate(ctx),
  ])
  if (!document) notFound()

  const currency = document.currencyCode || ctx.organization.baseCurrency
  const customer = document.customer
  const money = (value: string | number) => formatMoney(value, currency)

  const shareBody = [
    `${config.singular} ${document.number}`,
    `To: ${customer.displayName}`,
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
        <PrintButton
          paper={config.singular.toLowerCase()}
          backHref={`/sales/${config.slug}/${id}`}
          pdfHref={`/api/sales/${id}/pdf`}
          filename={filename}
          defaultTo={customer.email ?? ''}
          defaultSubject={`${config.singular} ${document.number} from ${organization.name}`}
          defaultBody={shareBody}
          whatsappPhone={customer.phone}
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
      />
    </div>
  )
}
