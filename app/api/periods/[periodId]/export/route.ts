import { NextResponse } from 'next/server'

import type { JournalSourceType } from '@prisma/client'

import { JOURNAL_SOURCE_LABELS } from '@/lib/accounting-labels'
import { toCalendarDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError, notFound } from '@/server/errors'
import {
  monthTitle,
  renderMonthPdf,
  renderMonthWorkbook,
  type MonthExport,
} from '@/server/reports/period-export'
import { statementPicture } from '@/components/reports/figure-chart'
import { profitAndLoss } from '@/server/reports/statements'
import * as journalService from '@/server/services/journal.service'
import * as periodService from '@/server/services/period.service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ periodId: string }> }) {
  try {
    const ctx = await requireOrgContext('journal:read')
    const { periodId } = await params
    const period = await periodService.find(ctx, periodId)
    if (!period) throw notFound('Accounting period')

    const url = new URL(request.url)
    const format = url.searchParams.get('format')
    if (format !== 'pdf' && format !== 'xlsx') {
      return NextResponse.json(
        { error: { code: 'VALIDATION', message: 'Choose pdf or xlsx.' } },
        { status: 400 },
      )
    }

    const q = url.searchParams.get('q')?.trim() || undefined
    const sourceRaw = url.searchParams.get('source') ?? undefined
    const sourceType =
      sourceRaw && sourceRaw in JOURNAL_SOURCE_LABELS ? (sourceRaw as JournalSourceType) : undefined
    const from = toCalendarDate(period.startDate)
    const to = toCalendarDate(period.endDate)
    const journals = await journalService.list(
      ctx,
      { page: 1, pageSize: 25, dir: 'asc', q },
      { sort: 'date', dir: 'asc', from, to, sourceType, unpaged: true },
    )

    let income: string | null = null
    let expenses: string | null = null
    let net: string | null = null
    if (ctx.permissions.has('report:read')) {
      const report = await profitAndLoss(ctx.orgId, { from, to })
      const picture = statementPicture(report.sections, 'total')
      const currency = ctx.organization.baseCurrency
      income = formatMoney(picture.income, currency)
      expenses = formatMoney(picture.expenses, currency)
      net = formatMoney(picture.net, currency)
    }

    const payload: MonthExport = {
      org: { ...ctx.organization, tradingName: ctx.organization.name },
      label: monthTitle(period.periodNumber, period.startDate),
      from,
      to,
      currency: ctx.organization.baseCurrency,
      income,
      expenses,
      net,
      rows: journals.rows,
    }

    const slug = payload.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (format === 'pdf') {
      const bytes = renderMonthPdf(payload)
      return new Response(Buffer.from(bytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${slug}.pdf"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const bytes = await renderMonthWorkbook(payload)
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${slug}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status })
    }
    console.error('[api/periods/export]', error)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Request failed.' } }, { status: 500 })
  }
}
