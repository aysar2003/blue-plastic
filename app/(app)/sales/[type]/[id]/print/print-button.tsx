'use client'

import { DocumentActions } from '@/components/print/document-actions'

/**
 * Toolbar for any printed page — Print, PDF, Email, WhatsApp.
 * Prefer passing pdfHref when a PDF route exists for the paper.
 */
export function PrintButton({
  paper = 'document',
  pdfHref,
  filename,
  printHref,
  defaultTo = '',
  defaultSubject,
  defaultBody,
  whatsappPhone,
  whatsappText,
}: {
  paper?: string
  pdfHref?: string
  filename?: string
  printHref?: string
  defaultTo?: string
  defaultSubject?: string
  defaultBody?: string
  whatsappPhone?: string | null
  whatsappText?: string
}) {
  return (
    <DocumentActions
      paper={paper}
      pdfHref={pdfHref}
      filename={filename}
      printHref={printHref}
      defaultTo={defaultTo}
      defaultSubject={defaultSubject}
      defaultBody={defaultBody}
      whatsappPhone={whatsappPhone}
      whatsappText={whatsappText}
    />
  )
}
