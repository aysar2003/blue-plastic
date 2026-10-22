import { NextResponse } from 'next/server'
import type { Workbook as ExcelWorkbook } from 'exceljs'

import { readSettings, type SearchParams } from '@/app/(app)/reports/params'
import { formatDate, toCalendarDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import { getOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { isAppError, unauthenticated } from '@/server/errors'
import * as portalService from '@/server/services/portal.service'
import { generalLedger } from '@/server/accounting/balances'
import * as payables from '@/server/services/payables.service'
import * as receivables from '@/server/services/receivables.service'

export const dynamic = 'force-dynamic'

type Movement = {
  date: Date
  dueDate: Date | null
  number: string
  kind: string
  description: string
  original: Decimal
  charge: Decimal
  credit: Decimal
}

/** Ledger spreadsheet for a customer or vendor statement. Same rows as the summary. */
export async function GET(request: Request) {
  try {
    const ctx = await getOrgContext()
    if (!ctx) throw unauthenticated()

    const url = new URL(request.url)
    const query = Object.fromEntries(url.searchParams) as SearchParams
    const requested = url.searchParams.get('party')
    const party = requested === 'vendor' || requested === 'account' ? requested : 'customer'
    const settings = readSettings(query, ctx.organization, 'year-to-date')

    let name = ''
    let opening = ZERO
    let entries: Movement[] = []

    if (party === 'vendor') {
      const vendorId = url.searchParams.get('vendorId')
      if (!vendorId) return missing('Choose a vendor first.')
      const vendor = await db.vendor.findFirst({
        where: { id: vendorId, orgId: ctx.orgId },
        select: { displayName: true },
      })
      if (!vendor) return missing('Vendor not found.', 404)
      const statement = await payables.vendorStatement(ctx, vendorId, settings.range)
      name = vendor.displayName
      opening = statement.opening
      entries = statement.entries
    } else if (party === 'account') {
      const accountId = url.searchParams.get('accountId')
      if (!accountId) return missing('Choose an account first.')
      const account = await db.ledgerAccount.findFirst({
        where: { id: accountId, orgId: ctx.orgId },
        select: { code: true, name: true },
      })
      if (!account) return missing('Account not found.', 404)
      const ledger = await generalLedger(ctx.orgId, accountId, settings.range, { limit: 1000 })
      name = `${account.code} ${account.name}`
      opening = ledger.opening
      entries = ledger.entries.map((entry) => ({
        date: entry.date,
        dueDate: null,
        number: entry.journalNumber,
        kind: entry.sourceType,
        description: entry.description ?? entry.memo ?? '',
        original: entry.debit.greaterThan(ZERO) ? entry.debit : entry.credit,
        charge: entry.debit,
        credit: entry.credit,
      }))
    } else {
      const customerId = url.searchParams.get('customerId')
      if (!customerId) return missing('Choose a customer first.')
      portalService.assertCustomerDataAccess(ctx, customerId)
      const customer = await db.customer.findFirst({
        where: { id: customerId, orgId: ctx.orgId },
        select: { displayName: true },
      })
      if (!customer) return missing('Customer not found.', 404)
      const statement = await receivables.statement(ctx, customerId, settings.range)
      name = customer.displayName
      opening = statement.opening
      entries = statement.entries
    }

    const loaded = (await import('exceljs')) as unknown as {
      Workbook?: new () => ExcelWorkbook
      default?: { Workbook: new () => ExcelWorkbook }
    }
    const Workbook = loaded.Workbook ?? loaded.default?.Workbook
    if (!Workbook) throw new Error('The Excel writer did not load')

    const workbook = new Workbook()
    workbook.creator = 'SOM ERP'
    const sheet = workbook.addWorksheet(
      party === 'vendor' ? 'Vendor statement' : party === 'account' ? 'Account statement' : 'Customer statement',
      {
      views: [{ state: 'frozen', ySplit: 1 }],
    })
    sheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Document', key: 'document', width: 22 },
      { header: 'Description', key: 'description', width: 32 },
      { header: 'Due', key: 'due', width: 14 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Debit', key: 'debit', width: 14 },
      { header: 'Credit', key: 'credit', width: 14 },
      { header: 'Total debit', key: 'totalDebit', width: 16 },
      { header: 'Current balance', key: 'balance', width: 18 },
    ]
    sheet.getRow(1).font = { bold: true }

    let runningDebit = ZERO
    let balance = opening
    sheet.addRow({
      date: '',
      document: 'Brought forward',
      description: name,
      due: '',
      amount: 0,
      debit: 0,
      credit: 0,
      totalDebit: 0,
      balance: Number(opening.toString()),
    })
    for (const entry of entries) {
      runningDebit = runningDebit.plus(entry.charge)
      balance = balance.plus(entry.charge).minus(entry.credit)
      sheet.addRow({
        date: formatDate(toCalendarDate(entry.date)),
        document: `${entry.kind} ${entry.number}`.trim(),
        description: entry.description,
        due: entry.dueDate ? formatDate(toCalendarDate(entry.dueDate)) : '',
        amount: Number(entry.original.toString()),
        debit: Number(entry.charge.toString()),
        credit: Number(entry.credit.toString()),
        totalDebit: Number(runningDebit.toString()),
        balance: Number(balance.toString()),
      })
    }
    const totals = sheet.addRow({
      document: 'Balance',
      debit: Number(runningDebit.toString()),
      credit: Number(entries.reduce((sum, entry) => sum.plus(entry.credit), ZERO).toString()),
      balance: Number(balance.toString()),
    })
    totals.font = { bold: true }

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `${party}-statement-${slug(name)}.xlsx`
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
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
    console.error('[api/statements/export]', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Request failed.' } },
      { status: 500 },
    )
  }
}

function missing(message: string, status = 422) {
  return NextResponse.json({ error: { code: status === 404 ? 'NOT_FOUND' : 'VALIDATION', message } }, { status })
}

function slug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned.slice(0, 40) || 'statement'
}
