'use client'

import { useEffect } from 'react'

import { useBrowserStore } from '@/lib/browser-store'
import { parseReportStyle, REPORT_STYLE_KEY } from '@/lib/report-styles'

/**
 * Keeps <html data-report-style> in sync with the Appearance picker, so every
 * [data-report-root] sheet (Reports, chart of accounts) uses the same fonts and rows.
 */
export function ReportStyleProvider() {
  const saved = useBrowserStore(REPORT_STYLE_KEY)
  const style = parseReportStyle(saved)

  useEffect(() => {
    document.documentElement.setAttribute('data-report-style', style)
  }, [style])

  return null
}
