import { NextResponse } from 'next/server'

import { CONTROLLED_MOVEMENT_HEADERS } from '@/lib/erp/export-headers'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import {
  preparedListResponse,
  readExportFormat,
} from '@/server/reports/prepared-list-export'
import * as itemLotService from '@/server/services/item-lot.service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('inventory:read')
    const format = readExportFormat(new URL(request.url), 'xlsx')
    const rows = await itemLotService.listControlledMovements(ctx, 500)
    return preparedListResponse({
      org: ctx.organization,
      title: 'Controlled movements',
      filenameBase: 'controlled-movements',
      format,
      columns: [
        { header: CONTROLLED_MOVEMENT_HEADERS[0], width: 12, kind: 'date' },
        { header: CONTROLLED_MOVEMENT_HEADERS[1], width: 28 },
        { header: CONTROLLED_MOVEMENT_HEADERS[2], width: 16 },
        { header: CONTROLLED_MOVEMENT_HEADERS[3], width: 16 },
        { header: CONTROLLED_MOVEMENT_HEADERS[4], width: 14 },
        { header: CONTROLLED_MOVEMENT_HEADERS[5], width: 12, kind: 'number' },
        { header: CONTROLLED_MOVEMENT_HEADERS[6], width: 16 },
      ],
      rows: rows.map((row) => [
        row.date,
        row.itemName,
        row.sku ?? '',
        row.lotNumber ?? '',
        row.type,
        row.quantity,
        row.journalNumber ?? '',
      ]),
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
