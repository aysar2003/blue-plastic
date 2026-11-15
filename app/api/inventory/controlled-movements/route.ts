import { NextResponse } from 'next/server'

import { controlledMovementsToCsv } from '@/lib/erp/pharmacy'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as itemLotService from '@/server/services/item-lot.service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = await requireOrgContext('inventory:read')
    const rows = await itemLotService.listControlledMovements(ctx, 500)
    const body = controlledMovementsToCsv(rows)
    return new Response(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="controlled-movements.csv"',
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
    console.error('[controlled-movements-export]', error)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Failed.' } }, { status: 500 })
  }
}