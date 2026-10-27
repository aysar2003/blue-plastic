import 'server-only'

import { formatDate } from '@/lib/date'
import {
  DEFAULT_DOCUMENT_TEMPLATE,
  type DocumentTemplate,
} from '@/lib/document-template'
import { formatMoney } from '@/lib/money'
import {
  merchantAccent,
  merchantPdfInk,
  merchantPdfLetterhead,
  merchantPdfMuted,
  merchantPdfTableHead,
} from '@/lib/merchant-pdf'
import { buildTextPdf, PDF_PAGE, type PdfRow } from '@/lib/pdf-text'
import type { PrintInk } from '@/lib/print-ink'
import type { DeliveryOrderDetail } from '@/server/services/delivery.service'

export function renderDeliveryReportPdf(input: {
  orgName: string
  orgAddress?: string[]
  orgPhone?: string | null
  orgEmail?: string | null
  currency: string
  filterLabel: string
  orders: DeliveryOrderDetail[]
  ink?: PrintInk
  template?: DocumentTemplate | null
}): Uint8Array {
  const template = input.template ?? DEFAULT_DOCUMENT_TEMPLATE
  const trade = template.paperStyle === 'trade'
  const accent = trade ? merchantPdfInk() : merchantAccent(template)
  const inkColor = merchantPdfInk()
  const muted = merchantPdfMuted()
  const money = (value: string) => formatMoney(value, input.currency)
  const rows: PdfRow[] = []
  const line = (
    text: string,
    options: { bold?: boolean; size?: number; height?: number; color?: readonly [number, number, number] } = {},
  ) => {
    rows.push({
      size: options.size ?? 10,
      height: options.height ?? 14,
      runs: [{ text, x: PDF_PAGE.left, bold: options.bold, color: options.color ?? inkColor }],
    })
  }

  rows.push(
    ...merchantPdfLetterhead({
      orgName: input.orgName,
      orgAddress: input.orgAddress,
      orgPhone: input.orgPhone,
      orgEmail: input.orgEmail,
      accent,
      plain: trade,
    }),
  )
  line('DELIVERY REPORT', { bold: true, size: 14, height: 18, color: accent })
  line(input.filterLabel, { size: 9, height: 12, color: muted })
  line(`${input.orders.length} purchase order${input.orders.length === 1 ? '' : 's'}`, {
    size: 9,
    height: 18,
  })

  for (const order of input.orders) {
    line(`${order.number} · ${order.vendorName}`, { bold: true, size: 10, height: 16 })
    line(
      `${formatDate(order.date)} · Ordered ${order.orderedQty} · Received ${order.receivedQty} · Outstanding ${order.outstandingQty}`,
      { size: 8, height: 12, color: muted },
    )
    line(
      `Value ordered ${money(order.orderedValue)} · received ${money(order.receivedValue)} · outstanding ${money(order.outstandingValue)}`,
      { size: 8, height: 14 },
    )

    rows.push(
      merchantPdfTableHead(
        [
          { text: 'Item', x: PDF_PAGE.left },
          { text: 'Ordered', x: 300, align: 'right' },
          { text: 'Received', x: 380, align: 'right' },
          { text: 'Outstanding', x: 470, align: 'right' },
          { text: 'Value due', x: PDF_PAGE.right, align: 'right' },
        ],
        accent,
      ),
    )

    for (const row of order.lines) {
      rows.push({
        size: 8,
        height: 12,
        runs: [
          {
            text: (row.itemName || row.description || 'Line').slice(0, 36),
            x: PDF_PAGE.left,
            color: inkColor,
          },
          { text: row.ordered, x: 300, align: 'right', color: inkColor },
          { text: row.received, x: 380, align: 'right', color: inkColor },
          { text: row.outstanding, x: 470, align: 'right', color: inkColor },
          {
            text: money(row.outstandingValue),
            x: PDF_PAGE.right,
            align: 'right',
            color: inkColor,
          },
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
