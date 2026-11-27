/**
 * Letterhead pack for PDF / Excel — default teal-navy vs Luxury champagne.
 * Mirrors html.luxury on the desk when the client builds download URLs.
 */

export type PrintLook = 'default' | 'luxury'

export function parsePrintLook(value: string | null | undefined): PrintLook {
  return value === 'luxury' ? 'luxury' : 'default'
}

export function readPrintLookFromDocument(): PrintLook {
  if (typeof document === 'undefined') return 'default'
  return document.documentElement.classList.contains('luxury') ? 'luxury' : 'default'
}

/** Append or replace `look=` on a PDF / export URL. */
export function withPrintLook(href: string, look: PrintLook): string {
  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    if (look === 'default') url.searchParams.delete('look')
    else url.searchParams.set('look', look)
    if (href.startsWith('http://') || href.startsWith('https://')) return url.toString()
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    if (look === 'default') return href
    const join = href.includes('?') ? '&' : '?'
    return `${href}${join}look=${look}`
  }
}

/** Apply current desk VIP look onto a PDF/export href. */
export function withDeskPrintLook(href: string): string {
  return withPrintLook(href, readPrintLookFromDocument())
}
