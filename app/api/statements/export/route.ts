import { NextResponse } from 'next/server'

import { readSettings, type SearchParams } from '@/app/(app)/reports/params'
import { formatDate, toCalendarDate, today } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import { getOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { isAppError, unauthenticated } from '@/server/errors'
import { renderListXlsx, xlsxResponse } from '@/server/reports/list-xlsx'
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

/** Ledger spreadsheet for a customer, vendor, or account statement. */
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

    const title =
      party === 'vendor'
        ? 'Vendor statement'
        : party === 'account'
          ? 'Account statement'
          : 'Customer statement'
    const rows: (string | number)[][] = []
    let runningDebit = ZERO
    let balance = opening
    rows.push(['', 'Brought forward', name, '', 0, 0, 0, 0, Number(opening.toString())])
    for (const entry of entries) {
      runningDebit = runningDebit.plus(entry.charge)
      balance = balance.plus(entry.charge).minus(entry.credit)
      rows.push([
        formatDate(toCalendarDate(entry.date)),
        `${entry.kind} ${entry.number}`.trim(),
        entry.description,
        entry.dueDate ? formatDate(toCalendarDate(entry.dueDate)) : '',
        Number(entry.original.toString()),
        Number(entry.charge.toString()),
        Number(entry.credit.toString()),
        Number(runningDebit.toString()),
        Number(balance.toString()),
      ])
    }
    rows.push([
      '',
      'Balance',
      '',
      '',
      '',
      Number(runningDebit.toString()),
      Number(entries.reduce((sum, entry) => sum.plus(entry.credit), ZERO).toString()),
      '',
      Number(balance.toString()),
    ])

    const bytes = await renderListXlsx({
      org: ctx.organization,
      title,
      subtitle: `${name} · ${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}`,
      currency: ctx.organization.baseCurrency,
      exportedAt: today(ctx.organization.timeZone),
      sheetName: title,
      columns: [
        { header: 'Date', width: 14, kind: 'date' },
        { header: 'Document', width: 22, kind: 'text' },
        { header: 'Description', width: 32, kind: 'text' },
        { header: 'Due', width: 14, kind: 'date' },
        { header: 'Amount', width: 14, kind: 'money' },
        { header: 'Debit', width: 14, kind: 'money' },
        { header: 'Credit', width: 14, kind: 'money' },
        { header: 'Total debit', width: 16, kind: 'money' },
        { header: 'Current balance', width: 18, kind: 'money' },
      ],
      rows,
    })
    return xlsxResponse(`${party}-statement-${slug(name)}.xlsx`, bytes)
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
