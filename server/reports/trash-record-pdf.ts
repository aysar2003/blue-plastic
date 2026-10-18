import 'server-only'

import { formatDateTime } from '@/lib/date'
import {
  DEFAULT_DOCUMENT_TEMPLATE,
  type DocumentTemplate,
} from '@/lib/document-template'
import {
  merchantAccent,
  merchantPdfInk,
  merchantPdfLetterhead,
  merchantPdfMuted,
} from '@/lib/merchant-pdf'
import { buildTextPdf, PDF_PAGE, type PdfRow } from '@/lib/pdf-text'
import type { PrintInk } from '@/lib/print-ink'

/**
 * Short trash paper when the original form cannot be rebuilt.
 * Same letterhead / accent as Print + invoice PDF (Settings → Templates).
 */
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
  template?: DocumentTemplate | null
}): Uint8Array {
  const template = input.template ?? DEFAULT_DOCUMENT_TEMPLATE
  const accent = merchantAccent(template)
  const ink = merchantPdfInk()
  const muted = merchantPdfMuted()
  const rows: PdfRow[] = []
  const line = (
    text: string,
    options: { bold?: boolean; size?: number; height?: number; color?: readonly [number, number, number] } = {},
  ) => {
    rows.push({
      size: options.size ?? 10,
      height: options.height ?? 14,
      runs: [
        {
          text,
          x: PDF_PAGE.left,
          bold: options.bold,
          color: options.color ?? ink,
        },
      ],
    })
  }

  rows.push(
    ...merchantPdfLetterhead({
      orgName: input.orgName,
      orgAddress: input.orgAddress,
      orgPhone: input.orgPhone,
      orgEmail: input.orgEmail,
      accent,
    }),
  )

  line('DELETED RECORD', { bold: true, size: 14, height: 18, color: accent })
  line(input.name ? `${input.kind} ${input.name}` : input.kind, { bold: true, size: 11, height: 16 })
  line('This record was deleted. It is not in the company books.', { size: 9, height: 12, color: muted })
  line(`Deleted ${formatDateTime(input.at, input.timeZone)} by ${input.who}`, {
    size: 9,
    height: 12,
    color: muted,
  })
  if (input.reason) line(`Reason: ${input.reason}`, { size: 9, height: 14 })
  rows.push({ height: 10, runs: [] })

  for (const field of input.fields) {
    line(`${field.label}: ${field.value}`, { size: 10, height: 14 })
  }

  return buildTextPdf(rows, { ink: input.ink })
}
