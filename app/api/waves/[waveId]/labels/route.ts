import { NextResponse } from 'next/server'

import { waveLabelCsvRows } from '@/lib/erp/wms-bin'
import { requireOrgContext } from '@/server/auth/context'
import { csvResponse } from '@/server/reports/csv'
import * as wms from '@/server/services/wms.service'

export async function GET(
  request: Request,
  context: { params: Promise<{ waveId: string }> },
) {
  const ctx = await requireOrgContext('inventory:read')
  const { waveId } = await context.params
  const payload = await wms.waveLabelExport(ctx, waveId)
  const format = new URL(request.url).searchParams.get('format')
  if (format === 'csv') {
    const orderById = new Map(payload.orders.map((order) => [order.orderId, order]))
    const lines = payload.pickLines.flatMap((pick) => {
      const order =
        pick.sourceType === 'SALES_ORDER' && pick.sourceId
          ? orderById.get(pick.sourceId)
          : undefined
      return [
        {
          waveNumber: payload.waveNumber,
          orderNumber: order?.orderNumber ?? '',
          customerName: order?.customerName ?? '',
          shipTo: order?.shipTo ?? null,
          carrier: order?.carrier ?? null,
          itemName: pick.itemName,
          sku: pick.sku,
          qty: pick.qty,
        },
      ]
    })
    const rows = [
      ['Wave', 'Order', 'Customer', 'Ship to', 'Carrier', 'Item', 'SKU', 'Qty'],
      ...waveLabelCsvRows(lines),
    ]
    return csvResponse(`wave-${payload.waveNumber}-labels.csv`, rows)
  }
  return NextResponse.json(payload)
}