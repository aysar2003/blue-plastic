import Link from 'next/link'
import { PackageIcon } from 'lucide-react'

import { ClickableRow } from '@/components/data/clickable-row'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { DeliveryBucket, DeliveryOrderDetail } from '@/server/services/delivery.service'

const BUCKET_LABEL: Record<DeliveryBucket, string> = {
  not_delivered: 'Not delivered',
  partial: 'Part delivered',
  delivered: 'Delivered',
}

const BUCKET_VARIANT: Record<DeliveryBucket, 'secondary' | 'warning' | 'success'> = {
  not_delivered: 'secondary',
  partial: 'warning',
  delivered: 'success',
}

export function DeliveryOrderTable({
  rows,
  currency,
  showReceive = true,
}: {
  rows: DeliveryOrderDetail[]
  currency: string
  showReceive?: boolean
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">Order</TableHead>
          <TableHead className="w-28">Date</TableHead>
          <TableHead>Vendor</TableHead>
          <TableHead className="w-32">Status</TableHead>
          <TableHead className="numeric w-24">Ordered</TableHead>
          <TableHead className="numeric w-24">Received</TableHead>
          <TableHead className="numeric w-28">Outstanding</TableHead>
          <TableHead className="numeric w-32">Still due</TableHead>
          {showReceive ? <TableHead className="w-28 print:hidden" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <ClickableRow key={row.id} href={row.href} title={`Open order ${row.number}`}>
            <TableCell>
              <Link href={row.href} className="tabular font-medium underline-offset-4 hover:underline">
                {row.number}
              </Link>
            </TableCell>
            <TableCell className="tabular whitespace-nowrap text-muted-foreground">
              {formatDate(row.date)}
            </TableCell>
            <TableCell>{row.vendorName}</TableCell>
            <TableCell>
              <Badge variant={BUCKET_VARIANT[row.bucket]}>{BUCKET_LABEL[row.bucket]}</Badge>
            </TableCell>
            <TableCell className="numeric tabular">{row.orderedQty}</TableCell>
            <TableCell className="numeric tabular">{row.receivedQty}</TableCell>
            <TableCell
              className={cn(
                'numeric tabular font-medium',
                row.bucket !== 'delivered' ? 'text-amber-800' : 'text-muted-foreground',
              )}
            >
              {row.outstandingQty}
            </TableCell>
            <TableCell className="numeric tabular font-medium">
              {row.bucket === 'delivered' ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                formatMoney(row.outstandingValue, currency)
              )}
            </TableCell>
            {showReceive ? (
              <TableCell className="print:hidden">
                {row.bucket !== 'delivered' ? (
                  <Link
                    href={row.receiveHref}
                    className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                  >
                    <PackageIcon />
                    Receive
                  </Link>
                ) : null}
              </TableCell>
            ) : null}
          </ClickableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function DeliveryBucketBadge({ bucket }: { bucket: DeliveryBucket }) {
  return <Badge variant={BUCKET_VARIANT[bucket]}>{BUCKET_LABEL[bucket]}</Badge>
}
