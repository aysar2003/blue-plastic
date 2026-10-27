import { NextResponse } from 'next/server'

import { letterheadOf } from '@/lib/letterhead'
import { parsePrintInk } from '@/lib/print-ink'
import { printableProjectQuotations } from '@/lib/project-quotations'
import { byType } from '@/lib/sales-types'
import { getOrgContext } from '@/server/auth/context'
import { isAppError, unauthenticated } from '@/server/errors'
import {
  renderProjectQuotationsPdf,
  type SalesDocumentPdfInput,
} from '@/server/reports/sales-document-pdf'
import * as organizationService from '@/server/services/organization.service'
import * as projectService from '@/server/services/project.service'
import * as salesService from '@/server/services/sales.service'

export const dynamic = 'force-dynamic'

/** Every quotation on a project, one PDF — original papers, running grand total. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const ctx = await getOrgContext()
    if (!ctx) throw unauthenticated()

    const ink = parsePrintInk(new URL(request.url).searchParams.get('ink'))
    const project = await projectService.get(ctx, id)
    const listed = printableProjectQuotations(project.sales)
    const [documents, org, template] = await Promise.all([
      salesService.getMany(
        ctx,
        listed.map((row) => row.id),
      ),
      organizationService.get(ctx),
      organizationService.getPrintTemplate(ctx, new URL(request.url).searchParams.get('paper')),
    ])

    const company = letterheadOf(org)
    const quotations = documents.filter((row) => row.type === 'QUOTATION')
    const shared = {
      ink,
      template,
      orgName: company.name,
      orgAddress: company.address ? [company.address] : [],
      orgPhone: company.phone,
      orgEmail: company.email,
    }

    const bytes = renderProjectQuotationsPdf({
      ...shared,
      projectNumber: project.number,
      projectName: project.name,
      siteLocation: project.siteLocation,
      customerName: project.customer.displayName,
      currency: ctx.organization.baseCurrency,
      quotations: quotations.map((document) => toPdfInput(document, shared, org.timeZone)),
    })

    const filename = `quotations-${project.number.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      )
    }
    console.error('[api/projects/quotations/pdf]', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Request failed.' } },
      { status: 500 },
    )
  }
}

function toPdfInput(
  document: Awaited<ReturnType<typeof salesService.getMany>>[number],
  shared: Pick<SalesDocumentPdfInput, 'ink' | 'template' | 'orgName' | 'orgAddress' | 'orgPhone' | 'orgEmail'>,
  timeZone: string | null | undefined,
): SalesDocumentPdfInput {
  const config = byType(document.type)
  const currency = document.currencyCode
  return {
    ...shared,
    title: config.singular,
    documentType: document.type,
    number: document.number,
    date: document.date,
    createdAt: document.createdAt,
    timeZone: timeZone ?? undefined,
    dueDate: document.dueDate,
    customerName: document.customer.displayName,
    customerAddress: [
      document.customer.billingLine1,
      document.customer.billingLine2,
      document.customer.billingCity,
      document.customer.billingRegion,
    ].filter((part): part is string => Boolean(part)),
    customerEmail: document.customer.email,
    customerPhone: document.customer.phone,
    reference: document.reference,
    paymentTerm: document.paymentTerm?.name ?? null,
    workScope: document.workScope,
    workSite: document.workSite || document.project?.siteLocation || null,
    status: document.status,
    createdByName: document.createdByName,
    currency,
    lines: document.lines.map((line) => ({
      quantity: line.quantity,
      sku: line.item?.sku ?? null,
      description: line.description ?? line.item?.name ?? 'Line',
      unitPrice: line.unitPrice,
      amount: line.amount,
      unitOfMeasure: line.item?.unitOfMeasure ?? null,
    })),
    subtotal: document.subtotal,
    discountAmount: document.discountAmount,
    taxTotal: document.taxTotal,
    total: document.total,
    amountApplied: document.amountApplied,
    balance: document.balance,
    message: document.customerMessage,
  }
}
