import { NextResponse } from 'next/server'

import { letterheadOf } from '@/lib/letterhead'
import { formatMoney, ZERO } from '@/lib/money'
import { parsePrintInk } from '@/lib/print-ink'
import { readSettings, type SearchParams } from '@/app/(app)/reports/params'
import { getOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { isAppError, unauthenticated } from '@/server/errors'
import { renderCustomerStatementPdf } from '@/server/reports/customer-statement-pdf'
import { screenPaperResponse } from '@/server/reports/screen-pdf'
import type { StatementEntry } from '@/server/services/receivables.service'
import * as organizationService from '@/server/services/organization.service'
import * as payables from '@/server/services/payables.service'

export const dynamic = 'force-dynamic'

/** The vendor statement on screen, downloaded as a PDF file. */
export async function GET(request: Request) {
  try {
    const ctx = await getOrgContext()
    if (!ctx) throw unauthenticated()

    const url = new URL(request.url)
    const ink = parsePrintInk(url.searchParams.get('ink'))
    const query = Object.fromEntries(url.searchParams) as SearchParams
    const vendorId = url.searchParams.get('vendorId')
    if (!vendorId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION', message: 'Choose a vendor first.' } },
        { status: 422 },
      )
    }

    const screen = await screenPaperResponse(
      `${url.origin}/reports/statements/vendor${url.search}`,
      request.headers.get('cookie') ?? '',
      'vendor-statement.pdf',
    )
    if (screen) return screen

    const vendor = await db.vendor.findFirst({
      where: { id: vendorId, orgId: ctx.orgId },
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
    if (!vendor) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Vendor not found.' } },
        { status: 404 },
      )
    }

    const settings = readSettings(query, ctx.organization, 'year-to-date')
    const [statement, org, template] = await Promise.all([
      payables.vendorStatement(ctx, vendorId, settings.range),
      organizationService.get(ctx),
      organizationService.getPrintTemplate(ctx, url.searchParams.get('paper')),
    ])
    const currency = ctx.organization.baseCurrency
    const company = letterheadOf(org)
    const bytes = renderCustomerStatementPdf({
      ink,
      template,
      heading: 'VENDOR STATEMENT',
      orgName: company.name,
      orgAddress: company.address ? [company.address] : [],
      orgPhone: company.phone,
      orgEmail: company.email,
      customerName: vendor.displayName,
      address: [
        vendor.companyName && vendor.companyName !== vendor.displayName ? vendor.companyName : '',
        [vendor.billingLine1, vendor.billingLine2].filter(Boolean).join(', '),
        [vendor.billingCity, vendor.billingRegion, vendor.billingPostalCode].filter(Boolean).join(' '),
      ].filter(Boolean),
      email: vendor.email,
      currency,
      from: settings.range.from,
      to: settings.range.to,
      opening: formatMoney(statement.opening, currency),
      charges: formatMoney(statement.entries.reduce((sum, entry) => sum.plus(entry.charge), ZERO), currency),
      credits: formatMoney(statement.entries.reduce((sum, entry) => sum.plus(entry.credit), ZERO), currency),
      closing: formatMoney(statement.closing, currency),
      filter: { view: 'detail', type: 'all', status: 'all', totals: 'line' },
      ledger: true,
      entries: statement.entries as unknown as StatementEntry[],
    })

    const filename = `vendor-statement-${slug(vendor.displayName)}.pdf`
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
    console.error('[api/statements/vendor]', error)
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
  return cleaned.slice(0, 40) || 'vendor'
}
