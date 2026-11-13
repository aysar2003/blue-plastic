import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { InvoiceFromSourceForm } from '@/components/sales/invoice-from-source-form'
import { SalesPaperFrame } from '@/components/sales/paper-width'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, toCalendarDate, today } from '@/lib/date'
import { bySlug, byType, STATUS_LABELS, STATUS_VARIANTS } from '@/lib/sales-types'
import { requireOrgContext } from '@/server/auth/context'
import * as salesService from '@/server/services/sales.service'

export const metadata: Metadata = { title: 'Create invoice' }

const PROGRESS_TYPES = new Set(['ESTIMATE', 'QUOTATION', 'SALES_ORDER'])

/**
 * Invoice part of an estimate, quotation, or sales order.
 *
 * A page of its own, like receiving a purchase order, because deciding how much
 * to bill is its own job. The source screen is for reading the source.
 */
export default async function InvoiceFromSourcePage({
  params,
}: {
  params: Promise<{ type: string; id: string }>
}) {
  const { type, id } = await params
  const config = bySlug(type)
  if (!config || !PROGRESS_TYPES.has(config.type)) notFound()

  const ctx = await requireOrgContext('invoice:create')
  const source = await salesService.invoiceableSource(ctx, id).catch(() => null)
  if (!source || source.type !== config.type) notFound()

  const blocked = source.status === 'VOID' || source.status === 'DECLINED' || source.status === 'DRAFT'

  return (
    <SalesPaperFrame>
      <PageHeader
        title={`Create invoice · ${source.number}`}
        className="mb-2 pb-2"
        description={source.customer.displayName}
        actions={
          <>
            <Link
              href={`/sales/${config.slug}/${id}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Back
            </Link>
            <Badge variant={STATUS_VARIANTS[source.status] ?? 'secondary'}>
              {STATUS_LABELS[source.status] ?? source.status}
            </Badge>
          </>
        }
      />

      {blocked ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {source.status === 'DRAFT'
              ? `${source.number} is still a draft. Save it before invoicing against it.`
              : `${source.number} is ${source.status.toLowerCase()}, so nothing can be invoiced against it.`}
          </CardContent>
        </Card>
      ) : (
        <>
          {source.invoices.length > 0 ? (
            <div className="mb-4 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Already invoiced on{' '}
              {source.invoices.map((invoice, index) => (
                <span key={invoice.id}>
                  {index > 0 ? ', ' : ''}
                  <Link
                    href={`/sales/${byType(invoice.type).slug}/${invoice.id}`}
                    className="font-medium underline underline-offset-4"
                  >
                    {invoice.number}
                  </Link>{' '}
                  <span className="text-xs">({formatDate(toCalendarDate(invoice.date))})</span>
                </span>
              ))}
              .
            </div>
          ) : null}

          <InvoiceFromSourceForm
            sourceId={source.id}
            sourceNumber={source.number}
            sourceType={source.type}
            customerName={source.customer.displayName}
            lines={source.lines}
            today={today(ctx.organization.timeZone)}
            currency={ctx.organization.baseCurrency}
          />
        </>
      )}
    </SalesPaperFrame>
  )
}
