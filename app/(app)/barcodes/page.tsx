import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { requireOrgContext } from '@/server/auth/context'
import * as barcodeService from '@/server/services/barcode.service'
import { BarcodesBoard } from './barcodes-board'

export const metadata: Metadata = { title: 'Barcodes' }

export default async function BarcodesPage() {
  const ctx = await requireOrgContext('item:read')
  const snap = await barcodeService.overview(ctx)

  return (
    <>
      <PageHeader
        title="Barcodes"
        description="Generate package codes for every product, print labels on a barcode printer, or download Excel. Scanned codes sell at the till."
      />
      <BarcodesBoard
        total={snap.total}
        activeTotal={snap.activeTotal}
        withBarcode={snap.withBarcode}
        withoutBarcode={snap.withoutBarcode}
        inactiveMissing={snap.inactiveMissing}
        missing={snap.missing}
        labelled={snap.labelled}
        catalog={snap.all}
        canEdit={ctx.permissions.has('item:update')}
      />
    </>
  )
}
