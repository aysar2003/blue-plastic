import { NextResponse } from 'next/server'
import type { Workbook as ExcelWorkbook } from 'exceljs'

import { formatDate, toCalendarDate } from '@/lib/date'
import { getOrgContext } from '@/server/auth/context'
import { isAppError, unauthenticated } from '@/server/errors'
import * as journalService from '@/server/services/journal.service'

export const dynamic = 'force-dynamic'

/** Spreadsheet of one journal entry — same lines as the detail screen. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getOrgContext()
    if (!ctx) throw unauthenticated()
    if (!ctx.permissions.has('journal:read') && !ctx.permissions.has('report:read')) {
      return NextResponse.json({ error: { message: 'Not allowed.' } }, { status: 403 })
    }

    const { id } = await params
    const journal = await journalService.get(ctx, id)
    const loaded = (await import('exceljs')) as unknown as {
      Workbook: new () => ExcelWorkbook
    }
    const workbook = new loaded.Workbook()
    const sheet = workbook.addWorksheet('Journal')

    sheet.addRow([journal.journalNumber])
    sheet.addRow([ctx.organization.name])
    sheet.addRow([`Date: ${formatDate(toCalendarDate(journal.date))}`])
    if (journal.memo) sheet.addRow([journal.memo])
    sheet.addRow([])
    sheet.addRow(['Account', 'Debit', 'Credit', 'Memo', 'Name'])

    for (const line of journal.lines) {
      sheet.addRow([
        `${line.account.code} ${line.account.name}`,
        line.debit === '0' ? '' : line.debit,
        line.credit === '0' ? '' : line.credit,
        line.description ?? '',
        line.customer?.displayName ?? line.vendor?.displayName ?? '',
      ])
    }

    sheet.addRow([])
    sheet.addRow(['Totals', journal.totalDebit, journal.totalCredit, '', ''])

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
    const filename = `${journal.journalNumber}.xlsx`
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      )
    }
    console.error('[api/journals/export]', error)
    return NextResponse.json({ error: { message: 'Export failed.' } }, { status: 500 })
  }
}
