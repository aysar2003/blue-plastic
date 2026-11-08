import { NextResponse } from 'next/server'

import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { renderListXlsx, xlsxResponse } from '@/server/reports/list-xlsx'
import * as barcodeService from '@/server/services/barcode.service'

export const dynamic = 'force-dynamic'

/** Excel sheet of every product that already has a barcode — for printers and stock labels. */
export async function GET() {
  try {
    const ctx = await requireOrgContext('item:read')
    const rows = await barcodeService.rowsForExport(ctx)
    const bytes = await renderListXlsx({
      org: ctx.organization,
      title: 'Barcodes',
      currency: ctx.organization.baseCurrency,
      exportedAt: today(ctx.organization.timeZone),
      sheetName: 'Barcodes',
      columns: [
        { header: 'Product/Service Name', width: 36, kind: 'text' },
        { header: 'SKU', width: 16, kind: 'text' },
        { header: 'Barcode', width: 18, kind: 'text' },
        { header: 'Type', width: 16, kind: 'text' },
        { header: 'Active', width: 10, kind: 'text' },
      ],
      rows: rows.map((row) => [row.name, row.sku, row.barcode, row.type, row.active]),
    })
    return xlsxResponse('barcodes.xlsx', bytes)
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      )
    }
    console.error('[api/exports/barcodes]', error)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Request failed.' } }, { status: 500 })
  }
}
