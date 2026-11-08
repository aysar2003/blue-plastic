import { NextResponse } from 'next/server'

import { formatDate, toCalendarDate, today } from '@/lib/date'
import { getOrgContext } from '@/server/auth/context'
import { isAppError, unauthenticated } from '@/server/errors'
import { renderListXlsx, xlsxResponse } from '@/server/reports/list-xlsx'
import * as journalService from '@/server/services/journal.service'

export const dynamic = 'force-dynamic'

/** Spreadsheet of one journal entry — company header + tidy lines. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getOrgContext()
    if (!ctx) throw unauthenticated()
    if (!ctx.permissions.has('journal:read') && !ctx.permissions.has('report:read')) {
      return NextResponse.json({ error: { message: 'Not allowed.' } }, { status: 403 })
    }

    const { id } = await params
    const journal = await journalService.get(ctx, id)
    const rows = journal.lines.map((line) => [
      `${line.account.code} ${line.account.name}`,
      line.debit === '0' ? '' : line.debit,
      line.credit === '0' ? '' : line.credit,
      line.description ?? '',
      line.customer?.displayName ?? line.vendor?.displayName ?? '',
    ])
    rows.push([])
    rows.push(['Totals', journal.totalDebit, journal.totalCredit, '', ''])

    const bytes = await renderListXlsx({
      org: ctx.organization,
      title: `Journal ${journal.journalNumber}`,
      subtitle: [
        `Date: ${formatDate(toCalendarDate(journal.date))}`,
        journal.memo ? journal.memo : null,
      ]
        .filter(Boolean)
        .join(' · '),
      currency: ctx.organization.baseCurrency,
      exportedAt: today(ctx.organization.timeZone),
      sheetName: 'Journal',
      columns: [
        { header: 'Account', width: 36, kind: 'text' },
        { header: 'Debit', width: 14, kind: 'money' },
        { header: 'Credit', width: 14, kind: 'money' },
        { header: 'Memo', width: 28, kind: 'text' },
        { header: 'Name', width: 24, kind: 'text' },
      ],
      rows,
    })
    return xlsxResponse(`${journal.journalNumber}.xlsx`, bytes)
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
