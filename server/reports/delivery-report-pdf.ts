import 'server-only'

import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { ODOO_PDF } from '@/lib/odoo-brand'
import { odooPdfLetterhead, odooPdfTableHead } from '@/lib/odoo-pdf'
import { buildTextPdf, PDF_PAGE, type PdfRow } from '@/lib/pdf-text'
import type { PrintInk } from '@/lib/print-ink'
import type { DeliveryOrderDetail } from '@/server/services/delivery.service'

export function renderDeliveryReportPdf(input: {
  orgName: string
  currency: string
  filterLabel: string
  orders: DeliveryOrderDetail[]
  ink?: PrintInk
}): Uint8Array {
  const money = (value: string) => formatMoney(value, input.currency)
  const rows: PdfRow[] = []
  const line = (text: string, options: { bold?: boolean; size?: number; height?: number } = {}) => {
    rows.push({
      size: options.size ?? 10,
      height: options.height ?? 14,
      runs: [{ text, x: PDF_PAGE.left, bold: options.bold, color: ODOO_PDF.ink }],
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
        { text: 'Item', x: PDF_PAGE.left },
        { text: 'Ordered', x: 300, align: 'right' },
        { text: 'Received', x: 380, align: 'right' },
        { text: 'Outstanding', x: 470, align: 'right' },
        { text: 'Value due', x: PDF_PAGE.right, align: 'right' },
      ]),
    )

    for (const row of order.lines) {
      rows.push({
        size: 8,
        height: 12,
        runs: [
          {
            text: (row.itemName || row.description || 'Line').slice(0, 36),
            x: PDF_PAGE.left,
            color: ODOO_PDF.ink,
          },
          { text: row.ordered, x: 300, align: 'right', color: ODOO_PDF.ink },
          { text: row.received, x: 380, align: 'right', color: ODOO_PDF.ink },
          { text: row.outstanding, x: 470, align: 'right', color: ODOO_PDF.ink },
          { text: money(row.outstandingValue), x: PDF_PAGE.right, align: 'right', color: ODOO_PDF.ink },
        ],
      })
    }
    line('', { height: 10 })
  }

  if (input.orders.length === 0) {
    line('No purchase orders in this filter.', { size: 10, height: 16 })
  }

  return buildTextPdf(rows, { ink: input.ink })
}
