'use client'

import { useEffect } from 'react'

import { parsePrintInk, rememberPrintInk, readStoredPrintInk } from '@/lib/print-ink'
import { parsePrintLook } from '@/lib/print-look'

/**
 * Keeps `data-print-ink` on <html> in sync with ?ink= or the last Print choice
 * so browser Print / Save as PDF respects Color vs Black & White.
 * Also applies ?look=luxury so headless PDF capture gets VIP champagne paper
 * even when localStorage theme is unavailable.
 * Also closes open menus before any print (Ctrl+P, toolbar, Save as PDF).
 */
export function PrintInkSync() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('ink')
    rememberPrintInk(fromQuery != null ? parsePrintInk(fromQuery) : readStoredPrintInk())

    if (parsePrintLook(params.get('look')) === 'luxury') {
      document.documentElement.classList.add('luxury')
      document.documentElement.dataset.printLook = 'luxury'
    }

    const onBeforePrint = () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    }
    window.addEventListener('beforeprint', onBeforePrint)
    return () => window.removeEventListener('beforeprint', onBeforePrint)
  }, [])

  return null
}
