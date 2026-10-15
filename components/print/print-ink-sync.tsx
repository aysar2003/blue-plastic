'use client'

import { useEffect } from 'react'

import { parsePrintInk, rememberPrintInk, readStoredPrintInk } from '@/lib/print-ink'

/**
 * Keeps `data-print-ink` on <html> in sync with ?ink= or the last Print choice
 * so browser Print / Save as PDF respects Color vs Black & White.
 */
export function PrintInkSync() {
  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('ink')
    rememberPrintInk(fromQuery != null ? parsePrintInk(fromQuery) : readStoredPrintInk())
  }, [])

  return null
}
