import Link from 'next/link'

import { PrintButton } from '@/app/(app)/sales/[type]/[id]/print/print-button'
import { MerchantInvoice } from '@/components/sales/merchant-invoice'
import { formatMoney, ZERO } from '@/lib/money'
import { printPackSectionClass } from '@/lib/print-pack'
import { hasPreviousQuotations, runningQuotationTotals } from '@/lib/project-quotations'
import type { DocumentTemplate } from '@/lib/document-template'
import type { LetterheadSource } from '@/lib/letterhead'

const VENDOR_WORDS = {
  party: 'Vendor',
  account: 'Vendor account',
  date: 'Bill date',
  person: 'Entered by',
  reference: 'Vendor ref',
  order: 'Reference',
}

export function DocumentPackView({
  documents,
  organization,
  template,
  baseCurrency,
  title,
  backHref,
  pdfHref,
  excelHref,
  filename,
  paper,
  configOf,
  runningTotals = false,
  vendorPaper = false,
  emptyHref,
  emptyLabel,
  approvals,
}: {
  documents: Parameters<typeof MerchantInvoice>[0]['document'][]
  organization: LetterheadSource & { timeZone?: string | null; taxRegistrationNumber?: string | null; name: string; legalName?: string | null }
  template: DocumentTemplate
  baseCurrency: string
  title: string
  backHref: string
  pdfHref: string
  excelHref?: string
  filename: string
  paper: string
  configOf: (type: string) => { type: string; singular: string }
  runningTotals?: boolean
  vendorPaper?: boolean
  emptyHref: string
  emptyLabel: string
  approvals?: Record<string, { name: string; at: Date }>
}) {
  const currency = documents[0]?.currencyCode || baseCurrency
  const running = runningTotals ? runningQuotationTotals(documents.map((row) => row.total)) : []
  const grand = documents.reduce((sum, row) => sum.plus(row.total), ZERO)
  const money = (value: string) => formatMoney(value, currency)
  const count = `${documents.length} ${documents.length === 1 ? paper : `${paper}s`}`
  const party = documents[0]?.customer
  const shareBody = [
    title,
    party ? `${vendorPaper ? 'Vendor' : 'Client'}: ${party.displayName}` : null,
    ...documents.map(
      (row, index) =>
        `${row.number}${row.workSite ? ` · ${row.workSite}` : ''}${row.workScope ? ` · ${row.workScope}` : ''} · ${money(row.total)}${
          runningTotals ? ` · running ${money(running[index]?.runningTotal ?? row.total)}` : ''
        }`,
    ),
    documents.length > 1 ? `Grand total ${money(grand.toFixed(4))}` : null,
    '',
    `From ${organization.legalName ?? organization.name}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <PrintButton
          paper={paper}
          backHref={backHref}
          pdfHref={pdfHref}
          excelHref={excelHref}
          filename={filename}
          pdfMatchesPrint
          paperStyle={template.paperStyle}
          defaultTo={party?.email ?? ''}
          defaultSubject={`${title} from ${organization.name}`}
          defaultBody={shareBody}
          whatsappPhone={party?.phone ?? null}
          whatsappText={shareBody}
        />
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No papers in this pack.{' '}
          <Link href={emptyHref} className="text-primary hover:underline">
            {emptyLabel}
          </Link>
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground print:hidden">
            {count}, each on the original paper
            {runningTotals ? '. The last grand total is every paper together.' : '.'}
          </p>

          {documents.map((document, index) => (
            <section
              key={document.id}
              data-print-paper
              className={printPackSectionClass(index, documents.length)}
            >
              <p className="mb-2 text-right text-xs print:hidden">
                <Link
                  href={`${emptyHref}/${document.id}`}
                  className="text-muted-foreground underline-offset-4 hover:underline"
                >
                  Open {document.number}
                </Link>
              </p>
              <MerchantInvoice
                document={document}
                organization={organization}
                template={template}
                config={configOf(document.type)}
                baseCurrency={baseCurrency}
                hideAccountBalance={runningTotals}
                previousQuotationsTotal={
                  runningTotals && hasPreviousQuotations(running[index]?.previousQuotationsTotal)
                    ? running[index].previousQuotationsTotal
                    : null
                }
                words={vendorPaper ? VENDOR_WORDS : undefined}
                approval={approvals?.[document.id] ?? null}
              />
            </section>
          ))}
        </>
      )}
    </div>
  )
}
