import { NextResponse } from 'next/server'

import { letterheadOf } from '@/lib/letterhead'
import { formatMoney, ZERO } from '@/lib/money'
import { readStatementFilter, visibleEntries } from '@/lib/customer-statement'
import { readSettings, type SearchParams } from '@/app/(app)/reports/params'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { isAppError } from '@/server/errors'
import { renderCustomerStatementPdf } from '@/server/reports/customer-statement-pdf'
import * as organizationService from '@/server/services/organization.service'
import * as receivables from '@/server/services/receivables.service'

export const dynamic = 'force-dynamic'

/**
 * The customer statement currently on screen, as a PDF.
 *
 * The query is the same one the page uses, so the file matches the filters:
 * dates, regular or detailed, type, and open / overdue / paid.
 */
export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('report:read')
    const url = new URL(request.url)
    const query = Object.fromEntries(url.searchParams) as SearchParams
    const customerId = url.searchParams.get('customerId')
    if (!customerId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION', message: 'Choose a customer first.' } },
        { status: 422 },
      )
    }

    const customer = await db.customer.findFirst({
      where: { id: customerId, orgId: ctx.orgId },
      select: {
        displayName: true,
        companyName: true,
        email: true,
        billingLine1: true,
        billingLine2: true,
        billingCity: true,
        billingRegion: true,
        billingPostalCode: true,
      },
    })
    if (!customer) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Customer not found.' } },
        { status: 404 },
      )
    }

    const settings = readSettings(query, ctx.organization, 'this-fiscal-year')
    const filter = readStatementFilter(query)
    const [statement, org] = await Promise.all([
      receivables.statement(ctx, customerId, settings.range),
      organizationService.get(ctx),
    ])
    const entries = visibleEntries(statement.entries, filter, settings.asOf)
    const currency = ctx.organization.baseCurrency
    const company = letterheadOf(org)
    const bytes = renderCustomerStatementPdf({
      orgName: company.name,
      orgAddress: company.address ? [company.address] : [],
      orgPhone: company.phone,
      orgEmail: company.email,
      customerName: customer.displayName,
      address: [
        customer.companyName && customer.companyName !== customer.displayName ? customer.companyName : '',
        [customer.billingLine1, customer.billingLine2].filter(Boolean).join(', '),
        [customer.billingCity, customer.billingRegion, customer.billingPostalCode].filter(Boolean).join(' '),
      ].filter(Boolean),
      email: customer.email,
      currency,
      from: settings.range.from,
      to: settings.range.to,
      opening: formatMoney(statement.opening, currency),
      charges: formatMoney(statement.entries.reduce((sum, entry) => sum.plus(entry.charge), ZERO), currency),
      credits: formatMoney(statement.entries.reduce((sum, entry) => sum.plus(entry.credit), ZERO), currency),
      closing: formatMoney(statement.closing, currency),
      filter,
      ledger: filter.type === 'all' && filter.status === 'all',
      entries,
    })

    const filename = `statement-${slug(customer.displayName)}.pdf`
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
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
    console.error('[api/statements/customer]', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Request failed.' } },
      { status: 500 },
    )
  }
}

function slug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned.slice(0, 40) || 'customer'
}
