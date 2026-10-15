import 'server-only'

import { formatDateTime } from '@/lib/date'
import { odooPdfLetterhead } from '@/lib/odoo-pdf'
import { ODOO_PDF } from '@/lib/odoo-brand'
import { buildTextPdf, type PdfRow } from '@/lib/pdf-text'
import type { PrintInk } from '@/lib/print-ink'

/** A short paper for a trash entry when the original form cannot be rebuilt. */
export function renderTrashRecordPdf(input: {
  orgName: string
  orgAddress: string[]
  orgPhone: string | null
  orgEmail: string | null
  kind: string
  name: string | null
  who: string
  at: Date
  timeZone: string
  reason: string | null
  fields: { label: string; value: string }[]
  ink?: PrintInk
}): Uint8Array {
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
      orgAddress: input.orgAddress,
      orgPhone: input.orgPhone,
      orgEmail: input.orgEmail,
      title: 'Deleted record',
      subtitle: input.name ? `${input.kind} ${input.name}` : input.kind,
    }),
  )

  line('This record was deleted. It is not in the company books.', { size: 9, height: 12 })
  line(`Deleted ${formatDateTime(input.at, input.timeZone)} by ${input.who}`, {
    size: 9,
    height: 12,
  })
  if (input.reason) line(`Reason: ${input.reason}`, { size: 9, height: 14 })
  rows.push({ height: 10, runs: [] })

  for (const field of input.fields) {
    line(`${field.label}: ${field.value}`, { size: 10, height: 14 })
  }

  return buildTextPdf(rows, { ink: input.ink })
}
