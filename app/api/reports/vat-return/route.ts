import { NextResponse } from 'next/server'

import { formatDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { renderListXlsx, xlsxResponse } from '@/server/reports/list-xlsx'
import * as statutoryExport from '@/server/services/statutory-export.service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('report:read')
    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const format = url.searchParams.get('format') === 'json' ? 'json' : 'xlsx'
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ error: 'from and to (YYYY-MM-DD) are required.' }, { status: 400 })
    }
    const pack = await statutoryExport.vatReturnExport(ctx, { from, to })
    if (pack.disabled) {
      return NextResponse.json({ error: 'Tax is turned off for this company.' }, { status: 400 })
    }
    if (format === 'json') {
      return new Response(pack.json, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="vat-return-${to}.json"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const boxes = pack.boxes
    const body = await renderListXlsx({
      org: ctx.organization,
      title: 'VAT return',
      subtitle: `${formatDate(from)} to ${formatDate(to)} · Jurisdiction ${boxes.jurisdiction}`,
      currency: ctx.organization.baseCurrency,
      sheetName: 'VAT return',
      columns: [
        { header: 'Box', width: 36 },
        { header: 'Amount', width: 16, kind: 'money' },
      ],
      rows: [
        ['Box 1 · Taxable supplies', boxes.box1TaxableSupplies],
        ['Box 2 · Output VAT', boxes.box2OutputVat],
        ['Box 3 · Taxable purchases', boxes.box3TaxablePurchases],
        ['Box 4 · Input VAT', boxes.box4InputVat],
        ['Box 5 · Net VAT due', boxes.box5NetVatDue],
      ],
    })
    return xlsxResponse(`vat-return-${to}.xlsx`, body)
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[vat-return]', error)
    return NextResponse.json({ error: 'Export failed.' }, { status: 500 })
  }
}
