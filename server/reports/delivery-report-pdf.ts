import 'server-only'

import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { buildTextPdf, type PdfRow } from '@/lib/pdf-text'
import type { DeliveryOrderDetail } from '@/server/services/delivery.service'

export function renderDeliveryReportPdf(input: {
  orgName: string
  currency: string
  filterLabel: string
  orders: DeliveryOrderDetail[]
}): Uint8Array {
  const money = (value: string) => formatMoney(value, input.currency)
  const rows: PdfRow[] = []
  const line = (text: string, options: { bold?: boolean; size?: number; height?: number } = {}) => {
    rows.push({
      size: options.size ?? 10,
      height: options.height ?? 14,
      runs: [{ text, x: 40, bold: options.bold }],
    })
  }

  line(input.orgName, { bold: true, size: 14, height: 18 })
  line('Delivery report', { bold: true, size: 12, height: 16 })
  line(input.filterLabel, { size: 9, height: 14 })
  line(`${input.orders.length} purchase order${input.orders.length === 1 ? '' : 's'}`, {
    size: 9,
    height: 18,
  })

  for (const order of input.orders) {
    line(`${order.number} · ${order.vendorName}`, { bold: true, size: 10, height: 16 })
    line(
      `${formatDate(order.date)} · Ordered ${order.orderedQty} · Received ${order.receivedQty} · Outstanding ${order.outstandingQty}`,
      { size: 8, height: 12 },
    )
    line(
      `Value ordered ${money(order.orderedValue)} · received ${money(order.receivedValue)} · outstanding ${money(order.outstandingValue)}`,
      { size: 8, height: 14 },
    )

    rows.push({
      size: 8,
      height: 14,
      rule: true,
      runs: [
        { text: 'Item', x: 40, bold: true },
        { text: 'Ordered', x: 280, bold: true },
        { text: 'Received', x: 360, bold: true },
        { text: 'Outstanding', x: 440, bold: true },
        { text: 'Value due', x: 520, bold: true },
      ],
    })

    for (const row of order.lines) {
      rows.push({
        size: 8,
        height: 12,
        runs: [
          { text: (row.itemName || row.description || 'Line').slice(0, 36), x: 40 },
          { text: row.ordered, x: 280 },
          { text: row.received, x: 360 },
          { text: row.outstanding, x: 440 },
          { text: money(row.outstandingValue), x: 520 },
        ],
      })
    }
    line('', { height: 10 })
  }

  if (input.orders.length === 0) {
    line('No purchase orders in this filter.', { size: 10, height: 16 })
  }

  return buildTextPdf(rows)
}
