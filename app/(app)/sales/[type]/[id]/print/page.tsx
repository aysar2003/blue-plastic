import { notFound } from 'next/navigation'

import { toCalendarDate } from '@/lib/date'
import {
  documentEmailBody,
  documentEmailSubject,
} from '@/lib/document-email'
import { formatMoney } from '@/lib/money'
import { documentStampLines } from '@/lib/document-stamp'
import { bySlug } from '@/lib/sales-types'
import { requireOrgContext } from '@/server/auth/context'
import * as approvalService from '@/server/services/approval.service'
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
 * Screen, Print, PDF, and Email all use this same sheet (Merchant/Trade + ink).
 */
export default async function PrintDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { type, id } = await params
  const query = await searchParams
  const paperParam = typeof query.paper === 'string' ? query.paper : null
  const config = bySlug(type)
  if (!config) notFound()

  const ctx = await requireOrgContext('invoice:read')
  const [document, organization, template] = await Promise.all([
    salesService.get(ctx, id).catch(() => null),
    organizationService.get(ctx),
    organizationService.getPrintTemplate(ctx, paperParam),
  ])
  if (!document || document.type !== config.type) notFound()

  const approvals = await approvalService.latestApprovals(ctx.orgId, [id])
  const approval = approvals.get(id) ?? null
  const currency = document.currencyCode || ctx.organization.baseCurrency
  const customer = document.customer
  const money = (value: string | number) => formatMoney(value, currency)

  const shareBody = documentEmailBody({
    partyName: customer.displayName,
    singular: config.singular,
    number: document.number,
    extraLines: [
      `Date: ${longDate(toCalendarDate(document.date), document.createdAt, organization.timeZone)}`,
      document.createdByName ? `Sales person: ${document.createdByName}` : null,
      document.workSite || document.project?.siteLocation
        ? `Work site: ${document.workSite || document.project?.siteLocation}`
        : null,
      document.workScope
        ? `Work / job: ${document.workScope} · Client: ${customer.displayName}`
        : null,
      `Total: ${money(document.total)}`,
      document.balance && Number(document.balance) > 0 ? `Amount due: ${money(document.balance)}` : null,
      ...documentStampLines({
        createdBy: document.createdByName,
        approvedBy: approval?.name,
        approvedAt: approval?.at,
        status: document.status,
      }),
    ],
  })

  const filename = `${config.slug.replace(/s$/, '')}-${document.number
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`

  // Same paper on screen, Print, PDF, and Email — template already applies
  // Settings + the Merchant/Trade cookie (query wins when present).
  const paperStyle = template.paperStyle

  return (
    <div className="mx-auto w-full max-w-3xl print:max-w-none">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <PrintButton
          paper={config.singular.toLowerCase()}
          backHref={`/sales/${config.slug}/${id}`}
          pdfHref={`/api/sales/${id}/pdf?paper=${paperStyle}`}
          excelHref={`/api/sales/${id}/xlsx`}
          filename={filename}
          pdfMatchesPrint
          paperStyle={paperStyle}
          defaultTo={customer.email ?? ''}
          defaultSubject={documentEmailSubject(
            config.singular,
            document.number,
            organization.name,
          )}
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
        approval={approval}
        hideAccountBalance={document.type === 'QUOTATION'}
      />
    </div>
  )
}
