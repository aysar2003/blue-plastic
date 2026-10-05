'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BellIcon,
  CheckIcon,
  ClockIcon,
  FileTextIcon,
  PackageCheckIcon,
  PrinterIcon,
  UserIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { markSaleTicketsPrepared } from '@/app/(app)/inventory/actions'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatDateTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { KeeperPickJob } from '@/server/services/inventory.service'

/**
 * Store-keeper pick queue — sale tickets waiting to be prepared for the customer.
 * International goods-issue pattern: customer, sale ref, lines, seller, time.
 */
export function StoreKeeperPicks({
  picks,
  timeZone,
  canPrepare,
}: {
  picks: KeeperPickJob[]
  timeZone: string
  canPrepare: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function prepare(ticketIds: string[]) {
    start(async () => {
      const result = await markSaleTicketsPrepared({ ticketIds })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(
        result.data.count === 1
          ? 'Ticket marked ready for the customer.'
          : `${result.data.count} tickets marked ready.`,
      )
      router.refresh()
    })
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <BellIcon className="size-4 text-primary" aria-hidden />
            Ready to issue
            {picks.length > 0 ? (
              <Badge variant="warning">{picks.length}</Badge>
            ) : null}
          </h2>
          <p className="text-sm text-muted-foreground">
            Sales tickets from the office (and other counters) for goods you prepare and hand to the
            customer — pick list with invoice, customer, and seller.
          </p>
        </div>
      </div>

      {picks.length === 0 ? (
        <Card tone="stock">
          <CardContent className="flex items-center gap-3 p-5 text-sm">
            <PackageCheckIcon className="size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">No open pick tickets</p>
              <p className="text-muted-foreground">
                When an invoice or sales receipt posts stock from this store, a ticket appears here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {picks.map((pick) => (
            <article
              key={pick.key}
              className={cn(
                'overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-[0_12px_28px_-18px_rgb(15_23_42/0.35)]',
                'ring-1 ring-primary/10',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 bg-[color-mix(in_srgb,var(--primary)_8%,var(--card))] px-4 py-3 sm:px-5">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="warning">To prepare</Badge>
                    {pick.deliveryNoteNumber ? (
                      <Link
                        href={`/sales/delivery/${pick.deliveryNoteId}`}
                        className="text-xs font-semibold tabular text-primary underline-offset-4 hover:underline"
                      >
                        DN {pick.deliveryNoteNumber}
                      </Link>
                    ) : null}
                  </div>
                  <h3 className="truncate text-lg font-semibold tracking-tight">{pick.customerName}</h3>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <FileTextIcon className="size-3.5" aria-hidden />
                      <Link href={pick.salesHref} className="font-medium text-foreground underline-offset-4 hover:underline">
                        {pick.salesNumber}
                      </Link>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ClockIcon className="size-3.5" aria-hidden />
                      {formatDate(pick.date)} · {formatDateTime(new Date(pick.issuedAt), timeZone)}
                    </span>
                    {pick.sellerName ? (
                      <span className="inline-flex items-center gap-1">
                        <UserIcon className="size-3.5" aria-hidden />
                        Sold by {pick.sellerName}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Items</p>
                  <p className="text-2xl font-semibold tabular">{pick.itemCount}</p>
                  <p className="text-xs text-muted-foreground">Qty {pick.totalQty}</p>
                </div>
              </div>

              <div className="px-4 py-3 sm:px-5">
                <ul className="divide-y divide-border/60">
                  {pick.lines.map((line) => (
                    <li key={line.ticketId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="font-medium">{line.itemName}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="tabular">{line.ticketNumber}</span>
                          {line.sku ? ` · ${line.sku}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular text-sm font-semibold">{line.quantity}</span>
                        <Link
                          href={line.printHref}
                          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                          title={`Print ${line.ticketNumber}`}
                        >
                          <PrinterIcon />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>

                {(pick.memo || pick.notes) && (
                  <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      Memo / notes
                    </p>
                    {pick.memo ? <p className="mt-0.5">{pick.memo}</p> : null}
                    {pick.notes ? <p className="mt-0.5 text-muted-foreground">{pick.notes}</p> : null}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {pick.deliveryNoteId ? (
                    <Link
                      href={`/sales/delivery/${pick.deliveryNoteId}/print`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      <PrinterIcon /> Print delivery note
                    </Link>
                  ) : null}
                  {canPrepare ? (
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => prepare(pick.ticketIds)}
                    >
                      <CheckIcon />
                      Mark prepared
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
