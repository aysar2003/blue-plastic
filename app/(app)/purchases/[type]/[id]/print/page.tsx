import { notFound } from 'next/navigation'

import { DocumentActions } from '@/components/print/document-actions'
import { longDate } from '@/components/sales/invoice-sheet'
import { MerchantInvoice } from '@/components/sales/merchant-invoice'
import { toCalendarDate } from '@/lib/date'
import {
  documentEmailBody,
  documentEmailSubject,
} from '@/lib/document-email'
import { documentStampLines } from '@/lib/document-stamp'
import { formatMoney } from '@/lib/money'
import { purchaseBySlug } from '@/lib/purchase-types'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
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
 * a sales invoice. Screen, Print, PDF, and Email all use this sheet.
 */
export default async function PrintPurchasePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { type, id } = await params
  const query = await searchParams
  const paperParam = typeof query.paper === 'string' ? query.paper : null
  const config = purchaseBySlug(type)
  if (!config) notFound()

  const ctx = await requireOrgContext('bill:read')
  const [rows, organization, template] = await Promise.all([
    purchaseService.getMany(ctx, [id]),
    organizationService.get(ctx),
    organizationService.getPrintTemplate(ctx, paperParam),
  ])
  const document = rows[0]
  if (!document || document.type !== config.type) notFound()

  const decision = await db.approvalDecision.findFirst({
    where: { orgId: ctx.orgId, decision: 'APPROVED', request: { entityId: id } },
    orderBy: { decidedAt: 'desc' },
    select: { decidedAt: true, decidedBy: { select: { name: true } } },
  })

  const currency = document.currencyCode || ctx.organization.baseCurrency
  const vendor = document.customer
  const money = (value: string | number) => formatMoney(value, currency)

  const shareBody = documentEmailBody({
    partyName: vendor.displayName,
    singular: config.singular,
    number: document.number,
    extraLines: [
      `Date: ${longDate(toCalendarDate(document.date), document.createdAt, organization.timeZone)}`,
      `Total: ${money(document.total)}`,
      document.balance && Number(document.balance) > 0 ? `Amount due: ${money(document.balance)}` : null,
      ...documentStampLines({
        createdBy: document.createdByName,
        approvedBy: decision?.decidedBy.name,
        approvedAt: decision?.decidedAt,
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
        <DocumentActions
          paper={config.singular.toLowerCase()}
          backHref={`/purchases/${config.slug}/${id}`}
          pdfHref={`/api/purchases/${id}/pdf?paper=${paperStyle}`}
          excelHref={`/api/purchases/${id}/xlsx`}
          filename={filename}
          pdfMatchesPrint
          paperStyle={paperStyle}
          defaultTo={vendor.email ?? ''}
          defaultSubject={documentEmailSubject(
            config.singular,
            document.number,
            organization.name,
          )}
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
        words={VENDOR_WORDS}
        approval={decision ? { name: decision.decidedBy.name, at: decision.decidedAt } : null}
      />
    </div>
  )
}
