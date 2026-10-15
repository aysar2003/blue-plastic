import { NextResponse } from 'next/server'
import type { Workbook as ExcelWorkbook } from 'exceljs'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as barcodeService from '@/server/services/barcode.service'

export const dynamic = 'force-dynamic'

/** Excel sheet of every product that already has a barcode — for printers and stock labels. */
export async function GET() {
  try {
    const ctx = await requireOrgContext('item:read')
    const rows = await barcodeService.rowsForExport(ctx)
    const loaded = (await import('exceljs')) as unknown as {
      Workbook?: new () => ExcelWorkbook
      default?: { Workbook: new () => ExcelWorkbook }
    }
    const Workbook = loaded.Workbook ?? loaded.default?.Workbook
    if (!Workbook) throw new Error('The Excel writer did not load')

    const workbook = new Workbook()
    workbook.creator = 'SOM ERP'
    const sheet = workbook.addWorksheet('Barcodes', {
      views: [{ state: 'frozen', ySplit: 1 }],
    })
    sheet.columns = [
      { header: 'Product/Service Name', key: 'name', width: 36 },
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Barcode', key: 'barcode', width: 18 },
      { header: 'Type', key: 'type', width: 16 },
      { header: 'Active', key: 'active', width: 10 },
    ]
    for (const row of rows) sheet.addRow(row)
    sheet.getRow(1).font = { bold: true }

    const buffer = await workbook.xlsx.writeBuffer()
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="barcodes.xlsx"',
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
    console.error('[api/exports/barcodes]', error)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Request failed.' } }, { status: 500 })
  }
}
