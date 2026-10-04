'use client'

import { DocumentActions } from '@/components/print/document-actions'

/**
 * Statement toolbar — same Print / PDF / Email / WhatsApp actions as every
 * other paper in the books.
 */
export function StatementSend({
  pdfHref,
  filename,
  defaultTo,
  defaultSubject,
  defaultBody,
  whatsappPhone,
}: {
  pdfHref: string
  filename: string
  defaultTo: string
  defaultSubject: string
  defaultBody: string
  whatsappPhone?: string | null
}) {
  return (
    <DocumentActions
      paper="statement"
      pdfHref={pdfHref}
      filename={filename}
      defaultTo={defaultTo}
      defaultSubject={defaultSubject}
      defaultBody={defaultBody}
      whatsappPhone={whatsappPhone}
      whatsappText={defaultBody}
    />
  )
}
