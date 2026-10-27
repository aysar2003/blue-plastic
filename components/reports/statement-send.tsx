'use client'

import { DocumentActions } from '@/components/print/document-actions'

/**
 * Statement toolbar — same Print / PDF / Email / WhatsApp actions as every
 * other paper in the books.
 */
export function StatementSend({
  pdfHref,
  excelHref,
  filename,
  defaultTo,
  defaultSubject,
  defaultBody,
  whatsappPhone,
  paperStyle,
}: {
  pdfHref: string
  excelHref?: string
  filename: string
  defaultTo: string
  defaultSubject: string
  defaultBody: string
  whatsappPhone?: string | null
  paperStyle?: 'merchant' | 'trade'
}) {
  return (
    <DocumentActions
      paper="statement"
      pdfHref={pdfHref}
      excelHref={excelHref}
      filename={filename}
      defaultTo={defaultTo}
      defaultSubject={defaultSubject}
      defaultBody={defaultBody}
      whatsappPhone={whatsappPhone}
      whatsappText={defaultBody}
      paperStyle={paperStyle}
    />
  )
}
