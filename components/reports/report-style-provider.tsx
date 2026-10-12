'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'

import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import { parseReportStyle, REPORT_STYLE_KEY, reportStyleForTheme } from '@/lib/report-styles'

/**
 * Keeps <html data-report-style> in sync with the Appearance picker, so every
 * [data-report-root] sheet (Reports, chart of accounts) uses the same fonts and rows.
 *
 * When the System look is SOM ERP (website navy + cyan), a leftover Odoo/QBO
 * report-paper pick is cleared on first hydrate so the desk matches the site.
 */
export function ReportStyleProvider() {
  const saved = useBrowserStore(REPORT_STYLE_KEY)
  const style = parseReportStyle(saved)
  const { theme, resolvedTheme } = useTheme()
  const hydrated = useRef(false)

  useEffect(() => {
    const active = theme ?? resolvedTheme
    if (!active || hydrated.current) return
    hydrated.current = true
    // SOM ERP is the website default. A leftover Odoo paper pick from an older
    // session steals navy/cyan — clear it once on hydrate. Manual paper picks
    // after that still stick until the user changes System look again.
    if (active === 'som' && parseReportStyle(saved) === 'odoo') {
      writeBrowserStore(REPORT_STYLE_KEY, reportStyleForTheme(active))
    }
  }, [theme, resolvedTheme, saved])

  useEffect(() => {
    document.documentElement.setAttribute('data-report-style', style)
  }, [style])

  return null
}
