'use client'

import { useEffect } from 'react'

import { parsePrintInk, rememberPrintInk, readStoredPrintInk } from '@/lib/print-ink'

/**
 * Keeps `data-print-ink` on <html> in sync with ?ink= or the last Print choice
 * so browser Print / Save as PDF respects Color vs Black & White.
 * Also closes open menus before any print (Ctrl+P, toolbar, Save as PDF).
 */
export function PrintInkSync() {
  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('ink')
    rememberPrintInk(fromQuery != null ? parsePrintInk(fromQuery) : readStoredPrintInk())

    const onBeforePrint = () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    }
    window.addEventListener('beforeprint', onBeforePrint)
    return () => window.removeEventListener('beforeprint', onBeforePrint)
  }, [])

  return null
}
