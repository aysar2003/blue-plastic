import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import {
  buildStockCountWorkbook,
  stockCountSheetRows,
} from '@/server/services/stock-count-sheet'

export const dynamic = 'force-dynamic'

/**
 * Stock-count worksheet for offline counting (Odoo-style).
 * Fill "Count found", then import on Adjust stock.
 */
export async function GET() {
  try {
    const ctx = await requireOrgContext('inventory:adjust')
    const rows = await stockCountSheetRows(ctx)
    const bytes = await buildStockCountWorkbook(rows)
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="stock-count.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status })
    }
    console.error('[api/exports/stock-count]', error)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Request failed.' } }, { status: 500 })
  }
}
