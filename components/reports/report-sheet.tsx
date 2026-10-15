'use client'

import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import {
  parseReportSheetTemplate,
  REPORT_SHEET_TEMPLATE_KEY,
  REPORT_SHEET_TEMPLATES,
  type ReportSheetTemplateId,
} from '@/lib/report-sheet-templates'
import { cn } from '@/lib/utils'

/**
 * Sheet wrapper that applies the shared Standard / Compact / Plain density
 * (Settings → Templates → Report & chart density) via data-template.
 */
export function ReportSheet({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const saved = useBrowserStore(REPORT_SHEET_TEMPLATE_KEY)
  const template = parseReportSheetTemplate(saved)

  return (
    <div data-report-root data-template={template} className={className}>
      {children}
    </div>
  )
}

/** Standard / Compact / Plain toggles — same control as chart of accounts. */
export function ReportRowStyleControls({ className }: { className?: string }) {
  const saved = useBrowserStore(REPORT_SHEET_TEMPLATE_KEY)
  const template = parseReportSheetTemplate(saved)

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)} role="group" aria-label="Row style">
      {REPORT_SHEET_TEMPLATES.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={template === item.id}
          onClick={() => writeBrowserStore(REPORT_SHEET_TEMPLATE_KEY, item.id)}
          className={`rounded-md px-2.5 py-1 text-sm ${
            template === item.id ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function useReportSheetTemplate(): ReportSheetTemplateId {
  return parseReportSheetTemplate(useBrowserStore(REPORT_SHEET_TEMPLATE_KEY))
}
