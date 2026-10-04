import { NextResponse } from 'next/server'

import { sampleRows, templateFor } from '@/lib/import-template'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as accountService from '@/server/services/account.service'
import { csvResponse } from '@/server/reports/csv'
import { buildImportTemplate } from '@/server/services/template-workbook'
import * as taxService from '@/server/services/tax.service'

export const dynamic = 'force-dynamic'

const KINDS = {
  customer: { permission: 'customer:create', sheet: 'Customers', file: 'customers' },
  vendor: { permission: 'vendor:create', sheet: 'Vendors', file: 'vendors' },
  item: { permission: 'item:create', sheet: 'Products', file: 'products' },
} as const

/**
 * The blank Excel sheet for customers, vendors, or products.
 *
 * Column headings are the fields the import reads, and the dropdowns are this
 * organisation's payment terms and account names, so a person can fill the
 * sheet later and have each cell land in the right place.
 */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const { kind } = await params
    const spec = KINDS[kind as keyof typeof KINDS]
    if (!spec) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Unknown template.' } }, { status: 404 })
    }

    const ctx = await requireOrgContext(spec.permission)
    const url = new URL(request.url)
    const sample = url.searchParams.get('sample') === '1'
    const csv = url.searchParams.get('format') === 'csv'
    const key = kind as keyof typeof KINDS
    const columns = templateFor(key)
    const examples = sample ? sampleRows(key) : []

    if (csv) {
      const rows = [columns.map((column) => column.header), ...examples]
      return csvResponse(`${spec.file}-${sample ? 'sample' : 'template'}.csv`, rows)
    }

    const [terms, accounts] = await Promise.all([
      taxService.listPaymentTerms(ctx),
      accountService.selectableAccounts(ctx),
    ])

    const bytes = await buildImportTemplate({
      sheetName: spec.sheet,
      columns,
      examples,
      lists: {
        terms: terms.map((term) => term.name),
        income: accounts.filter((account) => account.type === 'REVENUE').map((account) => account.name),
        expense: accounts.filter((account) => account.type === 'EXPENSE').map((account) => account.name),
        inventory: accounts.filter((account) => account.subtype === 'INVENTORY').map((account) => account.name),
      },
    })

    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${spec.file}-${sample ? 'sample' : 'template'}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status })
    }
    console.error('[api/import-templates]', error)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Request failed.' } }, { status: 500 })
  }
}
