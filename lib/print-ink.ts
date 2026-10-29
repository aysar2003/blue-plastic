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

/** Ask open menus/dialogs to close before Print / Save as PDF snapshots the page. */
function dismissPrintChrome() {
  if (typeof document === 'undefined') return
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

/** Apply ink mode and open the browser print dialog. */
export function printWithInk(ink: PrintInk) {
  rememberPrintInk(ink)
  dismissPrintChrome()
  // Radix closes menus after onSelect; print must wait or the open "Paper ink"
  // dropdown is stamped onto the printed page / Save as PDF.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.print()
    })
  })
}

/** Fetch a PDF URL and save it as a file. Avoids the browser opening the PDF inline. */
export async function downloadPdfFile(href: string, filename?: string): Promise<boolean> {
  const response = await fetch(href)
  if (!response.ok) return false
  const blob = await response.blob()
  if (blob.size < 200) return false
  const fromHeader = filenameFromContentDisposition(response.headers.get('content-disposition'))
  const name = filename || fromHeader || 'document.pdf'
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return true
}

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null
  const utf = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf?.[1]) return decodeURIComponent(utf[1])
  const plain = header.match(/filename="?([^";]+)"?/i)
  return plain?.[1] ?? null
}

/** Device RGB (0–1) → luminance grey for mono PDFs. */
export function toMonoRgb(rgb: readonly [number, number, number]): readonly [number, number, number] {
  const [r, g, b] = rgb
  const y = Math.min(1, Math.max(0, 0.299 * r + 0.587 * g + 0.114 * b))
  return [y, y, y]
}
