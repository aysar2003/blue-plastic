'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'

import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import {
  isVipTheme,
  parseReportStyle,
  parseReportStyleCustom,
  REPORT_STYLE_CUSTOM_KEY,
  REPORT_STYLE_KEY,
  reportStyleForTheme,
} from '@/lib/report-styles'

/**
 * Keeps <html data-report-style> in sync with the Appearance picker, so every
 * [data-report-root] sheet (Reports, chart of accounts, bank lists) uses the same fonts and rows.
 *
 * VIP skins (Luxury / AI) always keep their matching paper — a leftover Odoo or
 * Slate pick must not sit on the champagne / neural desk.
 */
export function ReportStyleProvider() {
  const saved = useBrowserStore(REPORT_STYLE_KEY)
  const customRaw = useBrowserStore(REPORT_STYLE_CUSTOM_KEY)
  const style = parseReportStyle(saved)
  const custom = parseReportStyleCustom(customRaw)
  const { theme, resolvedTheme, setTheme } = useTheme()
  const hydrated = useRef(false)

  useEffect(() => {
    // Retired QuickBooks Online desk skins → SOM ERP (light).
    if (theme === 'quick' || theme === 'quick-dark') {
      setTheme('som')
      writeBrowserStore(REPORT_STYLE_KEY, reportStyleForTheme('som'))
      return
    }

    // One-time: old `som` was navy. It is now the light day desk; move stored
    // navy sessions to `som-dark` so live users do not wake up on paper white.
    // Only rewrite when localStorage already held `som` — fresh browsers keep
    // the new light default.
    try {
      const flag = 'bp.theme.som-navy-split'
      if (window.localStorage.getItem(flag)) return
      window.localStorage.setItem(flag, '1')
      if (window.localStorage.getItem('theme') === 'som') {
        setTheme('som-dark')
        writeBrowserStore(REPORT_STYLE_KEY, reportStyleForTheme('som-dark'))
      }
    } catch {
      // Private mode: leave the picker default alone.
    }
  }, [theme, setTheme])

  useEffect(() => {
    const active =
      theme === 'quick' || theme === 'quick-dark' ? 'som' : (theme ?? resolvedTheme)
    if (!active) return

    const paper = parseReportStyle(saved)
    const paired = reportStyleForTheme(active)

    // VIP desks always wear their own sheet — Odoo/Slate leftovers bleach labels.
    if (isVipTheme(active) && paper !== paired) {
      writeBrowserStore(REPORT_STYLE_KEY, paired)
      hydrated.current = true
      return
    }

    if (hydrated.current) return
    hydrated.current = true

    // SOM ERP is the product default. A leftover Odoo/QBO paper pick from an older
    // session steals the desk — clear it once on hydrate. Manual paper picks
    // after that still stick until the user changes System look again.
    if (
      (active === 'som' || active === 'som-dark') &&
      (paper === 'odoo' || paper === 'quickbooks')
    ) {
      writeBrowserStore(REPORT_STYLE_KEY, reportStyleForTheme(active))
    }
  }, [theme, resolvedTheme, saved])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-report-style', style)
    if (style === 'custom') {
      root.style.setProperty('--report-custom-sheet', custom.sheet)
      root.style.setProperty('--report-custom-band', custom.band)
      root.style.setProperty('--report-custom-accent', custom.accent)
    } else {
      root.style.removeProperty('--report-custom-sheet')
      root.style.removeProperty('--report-custom-band')
      root.style.removeProperty('--report-custom-accent')
    }
  }, [style, custom.sheet, custom.band, custom.accent])

  return null
}
