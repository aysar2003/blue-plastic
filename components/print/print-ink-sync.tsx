'use client'

import { useEffect } from 'react'

import { parsePrintInk, rememberPrintInk, readStoredPrintInk } from '@/lib/print-ink'
import { parsePrintLook, readPrintLookFromDocument } from '@/lib/print-look'

/**
 * Keeps `data-print-ink` on <html> in sync with ?ink= or the last Print choice
 * so browser Print / Save as PDF respects Color vs Black & White.
 * Also applies ?look=luxury (and Luxury desk theme) so headless PDF / Print
 * get clean cream VIP paper even when localStorage theme is unavailable.
 * Also closes open menus before any print (Ctrl+P, toolbar, Save as PDF).
 */
function applyLuxuryPrintLook() {
  const fromQuery = parsePrintLook(new URLSearchParams(window.location.search).get('look'))
  const fromDesk = readPrintLookFromDocument()
  if (fromQuery !== 'luxury' && fromDesk !== 'luxury') {
    document.documentElement.removeAttribute('data-print-look')
    return
  }
  document.documentElement.classList.add('luxury')
  document.documentElement.dataset.printLook = 'luxury'
  document.documentElement.dataset.reportStyle = 'luxury'
}

export function PrintInkSync() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('ink')
    rememberPrintInk(fromQuery != null ? parsePrintInk(fromQuery) : readStoredPrintInk())

    applyLuxuryPrintLook()

    const onBeforePrint = () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      applyLuxuryPrintLook()
    }
    window.addEventListener('beforeprint', onBeforePrint)
    return () => window.removeEventListener('beforeprint', onBeforePrint)
  }, [])

  return null
}
