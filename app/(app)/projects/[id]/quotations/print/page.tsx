import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PrintButton } from '@/app/(app)/sales/[type]/[id]/print/print-button'
import { MerchantInvoice } from '@/components/sales/merchant-invoice'
import { documentStampLines } from '@/lib/document-stamp'
import { formatMoney, ZERO } from '@/lib/money'
import { printPackSectionClass } from '@/lib/print-pack'
import {
  hasPreviousQuotations,
  printableProjectQuotations,
  runningQuotationTotals,
} from '@/lib/project-quotations'
import { byType } from '@/lib/sales-types'
import { requireOrgContext } from '@/server/auth/context'
import * as approvalService from '@/server/services/approval.service'
import * as organizationService from '@/server/services/organization.service'
import * as projectService from '@/server/services/project.service'
import * as salesService from '@/server/services/sales.service'

export const metadata = { title: 'Print quotations' }

/**
 * Each project quotation on its own page, same paper as a single quotation.
 * Later pages add the previous quotations so the last grand total is the job.
 */
export default async function ProjectQuotationsPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireOrgContext('invoice:read')
  const project = await projectService.get(ctx, id).catch(() => null)
  if (!project) notFound()

  const listed = printableProjectQuotations(project.sales)
  const [documents, organization, template] = await Promise.all([
    salesService.getMany(
      ctx,
      listed.map((row) => row.id),
    ),
    organizationService.get(ctx),
    organizationService.getPrintTemplate(ctx),
  ])
  const quotations = documents.filter((row) => row.type === 'QUOTATION')
  const approvals = await approvalService.latestApprovals(
    ctx.orgId,
    quotations.map((row) => row.id),
  )
  const running = runningQuotationTotals(quotations.map((row) => row.total))
  const currency = ctx.organization.baseCurrency
  const grand = quotations.reduce((sum, row) => sum.plus(row.total), ZERO)
  const money = (value: string) => formatMoney(value, currency)
  const count = `${quotations.length} ${quotations.length === 1 ? 'quotation' : 'quotations'}`
  const shareBody = [
    `Quotations — ${project.number} ${project.name}`,
    `Client: ${project.customer.displayName}`,
    ...quotations.map(
      (row, index) =>
        `${row.number}${row.workSite ? ` · ${row.workSite}` : ''}${row.workScope ? ` · ${row.workScope}` : ''} · ${money(row.total)} · running ${money(running[index]?.runningTotal ?? row.total)}`,
    ),
    `Grand total ${money(grand.toFixed(4))}`,
    ...quotations.flatMap((row) => {
      const approval = approvals.get(row.id)
      return [
        '',
        row.number,
        ...documentStampLines({
          createdBy: row.createdByName,
          approvedBy: approval?.name,
          approvedAt: approval?.at,
          status: row.status,
        }),
      ]
    }),
    '',
    `From ${organization.legalName ?? organization.name}`,
  ].join('\n')
  const filename = `quotations-${project.number.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <PrintButton
          paper="quotations"
          backHref={`/projects/${project.id}`}
          pdfHref={`/api/projects/${project.id}/quotations/pdf`}
          filename={filename}
          pdfMatchesPrint
          paperStyle={template.paperStyle}
          defaultTo={quotations[0]?.customer.email ?? ''}
          defaultSubject={`Quotations ${project.number} from ${organization.name}`}
          defaultBody={shareBody}
          whatsappPhone={quotations[0]?.customer.phone ?? null}
          whatsappText={shareBody}
        />
      </div>

      {quotations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No quotations on this project yet.{' '}
          <Link href={`/sales/quotations/new?project=${project.id}&customer=${project.customer.id}`} className="text-primary hover:underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground print:hidden">
            {count}, each on the original quotation paper. The last grand total is every quotation
            together.
          </p>

          {quotations.map((document, index) => (
            <section
              key={document.id}
              data-print-paper
              className={printPackSectionClass(index, quotations.length)}
            >
              <p className="mb-2 text-right text-xs print:hidden">
                <Link
                  href={`/sales/quotations/${document.id}`}
                  className="text-muted-foreground underline-offset-4 hover:underline"
                >
                  Open {document.number}
                </Link>
              </p>
              <MerchantInvoice
                document={document}
                organization={organization}
                template={{ ...template, paperStyle: 'merchant' }}
                config={byType(document.type)}
                baseCurrency={currency}
                approval={approvals.get(document.id) ?? null}
                hideAccountBalance
                previousQuotationsTotal={
                  hasPreviousQuotations(running[index]?.previousQuotationsTotal)
                    ? running[index].previousQuotationsTotal
                    : null
                }
              />
            </section>
          ))}
        </>
      )}
    </div>
  )
}
