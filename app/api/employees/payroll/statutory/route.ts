import { NextResponse } from 'next/server'

import { formatDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { renderListXlsx, xlsxResponse } from '@/server/reports/list-xlsx'
import * as statutoryExport from '@/server/services/statutory-export.service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('hr:payroll')
    const url = new URL(request.url)
    const from = url.searchParams.get('from') ?? `${new Date().getFullYear()}-01-01`
    const to = url.searchParams.get('to') ?? `${new Date().getFullYear()}-12-31`
    const format = url.searchParams.get('format') === 'json' ? 'json' : 'xlsx'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ error: 'Invalid dates.' }, { status: 400 })
    }
    const pack = await statutoryExport.payrollStatutoryExport(ctx, { from, to })
    if (format === 'json') {
      return new Response(pack.json, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="payroll-statutory-${to}.json"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const rows = pack.rows.flatMap((row) => {
      if (row.lines.length === 0) {
        return [
          [
            row.periodStart,
            row.periodEnd,
            row.payslipNumber ?? '',
            row.employeeCode ?? '',
            row.employeeName,
            row.department ?? '',
            row.gross,
            row.deductions,
            row.employer,
            row.net,
            '',
            '',
            '',
            '',
          ],
        ]
      }
      return row.lines.map((line) => [
        row.periodStart,
        row.periodEnd,
        row.payslipNumber ?? '',
        row.employeeCode ?? '',
        row.employeeName,
        row.department ?? '',
        row.gross,
        row.deductions,
        row.employer,
        row.net,
        line.code,
        line.label,
        line.kind,
        line.amount,
      ])
    })

    const body = await renderListXlsx({
      org: ctx.organization,
      title: 'Payroll statutory export',
      subtitle: `${formatDate(from)} to ${formatDate(to)}`,
      currency: ctx.organization.baseCurrency,
      sheetName: 'Payroll statutory',
      columns: [
        { header: 'Period start', width: 12, kind: 'date' },
        { header: 'Period end', width: 12, kind: 'date' },
        { header: 'Payslip', width: 12 },
        { header: 'Employee code', width: 14 },
        { header: 'Employee', width: 24 },
        { header: 'Department', width: 16 },
        { header: 'Gross', width: 12, kind: 'money' },
        { header: 'Deductions', width: 12, kind: 'money' },
        { header: 'Employer', width: 12, kind: 'money' },
        { header: 'Net', width: 12, kind: 'money' },
        { header: 'Line code', width: 12 },
        { header: 'Line label', width: 22 },
        { header: 'Line kind', width: 12 },
        { header: 'Line amount', width: 12, kind: 'money' },
      ],
      rows,
    })
    return xlsxResponse(`payroll-statutory-${to}.xlsx`, body)
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[payroll-statutory]', error)
    return NextResponse.json({ error: 'Export failed.' }, { status: 500 })
  }
}
