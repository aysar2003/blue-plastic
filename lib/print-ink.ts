/**
 * Colour vs black-and-white for every printed paper and generated PDF.
 * Remembered for the tab so Print / PDF keep the last choice.
 */

export type PrintInk = 'color' | 'mono'

const STORAGE_KEY = 'print-ink'

export function parsePrintInk(value: string | null | undefined): PrintInk {
  return value === 'mono' ? 'mono' : 'color'
}

export function readStoredPrintInk(): PrintInk {
  if (typeof window === 'undefined') return 'color'
  try {
    return parsePrintInk(sessionStorage.getItem(STORAGE_KEY))
  } catch {
    return 'color'
  }
}

export function rememberPrintInk(ink: PrintInk) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.printInk = ink
  }
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, ink)
  } catch {
    /* private mode */
  }
}

/** Append or replace `ink=` on a PDF / print URL. */
export function withPrintInk(href: string, ink: PrintInk): string {
  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    url.searchParams.set('ink', ink)
    if (href.startsWith('http://') || href.startsWith('https://')) return url.toString()
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    const join = href.includes('?') ? '&' : '?'
    return `${href}${join}ink=${ink}`
  }
}

/** Apply ink mode and open the browser print dialog. */
export function printWithInk(ink: PrintInk) {
  rememberPrintInk(ink)
  window.print()
}

/** Device RGB (0–1) → luminance grey for mono PDFs. */
export function toMonoRgb(rgb: readonly [number, number, number]): readonly [number, number, number] {
  const [r, g, b] = rgb
  const y = Math.min(1, Math.max(0, 0.299 * r + 0.587 * g + 0.114 * b))
  return [y, y, y]
}
