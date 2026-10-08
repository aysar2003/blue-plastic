import 'server-only'

import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { ODOO_PDF } from '@/lib/odoo-brand'
import { odooPdfLetterhead, odooPdfTableHead } from '@/lib/odoo-pdf'
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
      runs: [{ text, x: 40, bold: options.bold, color: ODOO_PDF.ink }],
    })
  }

  rows.push(
    ...odooPdfLetterhead({
      orgName: input.orgName,
      title: 'Delivery report',
      subtitle: input.filterLabel,
    }),
  )
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

    rows.push(
      odooPdfTableHead([
        { text: 'Item', x: 40 },
        { text: 'Ordered', x: 280 },
        { text: 'Received', x: 360 },
        { text: 'Outstanding', x: 440 },
        { text: 'Value due', x: 520 },
      ]),
    )

    for (const row of order.lines) {
      rows.push({
        size: 8,
        height: 12,
        runs: [
          { text: (row.itemName || row.description || 'Line').slice(0, 36), x: 40, color: ODOO_PDF.ink },
          { text: row.ordered, x: 280, color: ODOO_PDF.ink },
          { text: row.received, x: 360, color: ODOO_PDF.ink },
          { text: row.outstanding, x: 440, color: ODOO_PDF.ink },
          { text: money(row.outstandingValue), x: 520, color: ODOO_PDF.ink },
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
