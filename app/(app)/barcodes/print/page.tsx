import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { LabelSheet } from '@/components/barcodes/label-sheet'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { requireOrgContext } from '@/server/auth/context'
import * as barcodeService from '@/server/services/barcode.service'

export const metadata: Metadata = { title: 'Print barcodes' }

export default async function BarcodesPrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('item:read')
  const params = await searchParams
  const raw = typeof params.ids === 'string' ? params.ids : ''
  const ids = raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  const autoprint = params.print === '1'

  const rows = await barcodeService.rowsForPrint(ctx, ids.length > 0 ? ids : undefined)

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Print barcode labels"
          description="Each sticker shows the product name and a scannable Code 128 barcode. Print on your barcode label machine — pick the roll size that matches your labels."
          actions={
            <Link href="/barcodes" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Back to Barcodes
            </Link>
          }
        />
      </div>
      <LabelSheet
        autoprint={autoprint}
        rows={rows
          .filter((row): row is typeof row & { barcode: string } => Boolean(row.barcode))
          .map((row) => ({
            id: row.id,
            name: row.name,
            sku: row.sku,
            barcode: row.barcode,
          }))}
      />
    </>
  )
}
