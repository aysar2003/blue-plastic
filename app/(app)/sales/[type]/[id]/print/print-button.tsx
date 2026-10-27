'use client'

import { DocumentActions } from '@/components/print/document-actions'
import type { PaperStyle } from '@/lib/document-template'

/**
 * Toolbar for any printed page — Print, PDF, Email, WhatsApp.
 * Prefer passing pdfHref when a PDF route exists for the paper.
 */
export function PrintButton({
  paper = 'document',
  pdfHref,
  excelHref,
  filename,
  printHref,
  backHref,
  defaultTo = '',
  defaultSubject,
  defaultBody,
  whatsappPhone,
  whatsappText,
  pdfMatchesPrint = false,
  paperStyle,
}: {
  paper?: string
  pdfHref?: string
  excelHref?: string
  filename?: string
  printHref?: string
  backHref?: string
  defaultTo?: string
  defaultSubject?: string
  defaultBody?: string
  whatsappPhone?: string | null
  whatsappText?: string
  pdfMatchesPrint?: boolean
  paperStyle?: PaperStyle
}) {
  return (
    <DocumentActions
      paper={paper}
      pdfHref={pdfHref}
      excelHref={excelHref}
      filename={filename}
      printHref={printHref}
      backHref={backHref}
      defaultTo={defaultTo}
      defaultSubject={defaultSubject}
      defaultBody={defaultBody}
      whatsappPhone={whatsappPhone}
      whatsappText={whatsappText}
      pdfMatchesPrint={pdfMatchesPrint}
      paperStyle={paperStyle}
    />
  )
}
