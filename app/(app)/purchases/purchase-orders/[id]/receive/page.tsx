import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { ReceiveForm } from '@/components/purchases/receive-form'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, toCalendarDate, today } from '@/lib/date'
import { STATUS_LABELS, STATUS_VARIANTS } from '@/lib/sales-types'
import { requireOrgContext } from '@/server/auth/context'
import * as purchaseService from '@/server/services/purchase.service'

export const metadata: Metadata = { title: 'Receive items' }

/**
 * The receiving screen for one purchase order.
 *
 * A page of its own rather than a control on the order, because booking in a
 * delivery is its own job with its own paperwork in hand: a note listing what
 * turned up, checked line by line against what was ordered. The order screen is
 * for reading the order.
 */
export default async function ReceiveOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('bill:create')
  const { id } = await params
  const query = await searchParams
  const returnTo = typeof query.return === 'string' && query.return.startsWith('/') ? query.return : null

  const order = await purchaseService.receivableOrder(ctx, id).catch(() => null)
  if (!order) notFound()

  return (
    <>

      <PageHeader
        title={`Receive items · ${order.number}`}
        className="mb-2 pb-2"
        actions={
          <>
            {returnTo ? (
              <Link href={returnTo} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Back
              </Link>
            ) : null}
            <Badge variant={STATUS_VARIANTS[order.status] ?? 'secondary'}>
              {STATUS_LABELS[order.status] ?? order.status}
            </Badge>
          </>
        }
      />

      {order.status === 'VOID' || order.status === 'DRAFT' ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {order.status === 'VOID'
              ? `${order.number} is void, so nothing can be received against it.`
              : `${order.number} is still a draft. Save it as an order before booking a delivery in against it.`}
          </CardContent>
        </Card>
      ) : (
        <>
          {order.receipts.length > 0 ? (
            <div className="mb-4 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Already received on{' '}
              {order.receipts.map((receipt, index) => (
                <span key={receipt.id}>
                  {index > 0 ? ', ' : ''}
                  <Link
                    href={`/purchases/bills/${receipt.id}`}
                    className="font-medium underline underline-offset-4"
                  >
                    {receipt.number}
                  </Link>{' '}
                  <span className="text-xs">({formatDate(toCalendarDate(receipt.date))})</span>
                </span>
              ))}
              .
            </div>
          ) : null}

          <ReceiveForm
            orderId={order.id}
            orderNumber={order.number}
            vendorName={order.vendor.displayName}
            lines={order.lines}
            today={today(ctx.organization.timeZone)}
            currency={ctx.organization.baseCurrency}
          />
        </>
      )}
    </>
  )
}
