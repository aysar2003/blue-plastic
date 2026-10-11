import { NextResponse } from 'next/server'

import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as auditService from '@/server/services/audit.service'

/**
 * Trash. An infinite list of deletions, with no link back into the books.
 * A Server Component cannot serve a list the user scrolls without navigating
 * (ADR-0004), so this is one of the few route handlers.
 */
export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('audit:read')
    const params = Object.fromEntries(new URL(request.url).searchParams)
    const page = await auditService.list(ctx, parseListQuery(params))

    return NextResponse.json({
      ...page,
      rows: page.rows.map((row) => ({ ...row, at: row.at.toISOString() })),
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      )
    }
    console.error('[api/audit-logs]', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Request failed.' } },
      { status: 500 },
    )
  }
}
