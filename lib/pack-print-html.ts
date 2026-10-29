/**
 * Snapshot on-screen print papers into HTML, then Chrome prints the same sheet
 * the user sees (Pack / single print / statements / delivery / tickets).
 */

/** Wins over app @page / body rules copied from the live page. */
const PRINT_CSS = `
@page { size: A4; margin: 12mm; }
html, body {
  margin: 0 !important;
  padding: 0 !important;
  min-height: 0 !important;
  height: auto !important;
  display: block !important;
  background: #fff !important;
  color: #1f2933 !important;
}
html[data-print-ink="mono"],
html[data-print-ink="mono"] body {
  filter: grayscale(1);
}
section[data-print-paper],
section[data-invoice-page] {
  break-after: page;
  page-break-after: always;
  margin: 0 !important;
  padding: 0 !important;
}
section[data-print-paper]:last-of-type,
section[data-invoice-page]:last-of-type {
  break-after: auto;
  page-break-after: auto;
}
article.merchant-invoice,
article.invoice-sheet {
  margin: 0 !important;
  min-height: 0 !important;
  box-shadow: none !important;
}
.break-inside-avoid { break-inside: avoid !important; page-break-inside: avoid !important; }
thead { display: table-header-group !important; }
tr { break-inside: avoid !important; page-break-inside: avoid !important; }
.print\\:hidden, .print\\:hidden * { display: none !important; }
[data-slot="dropdown-menu-content"],
[data-slot="dialog-overlay"],
[data-slot="dialog-content"],
[data-slot="popover-content"],
[data-slot="combobox-panel"],
[data-radix-popper-content-wrapper],
[data-radix-portal] { display: none !important; }
`

/** Selectors for every printable paper the app draws on screen. */
const PAPER_SELECTORS = [
  'section[data-print-paper]',
  'section[data-invoice-page]',
  'article.merchant-invoice',
  'article.invoice-sheet',
  '[data-report-root]',
  '[data-print-root]',
].join(', ')

export function hasPrintablePaper(): boolean {
  if (typeof document === 'undefined') return false
  return Boolean(document.querySelector(PAPER_SELECTORS))
}

function stripChrome(root: HTMLElement) {
  root
    .querySelectorAll(
      [
        '.print\\:hidden',
        '[class*="print:hidden"]',
        '[data-slot="dialog-content"]',
        '[data-slot="dialog-overlay"]',
        '[data-slot="dropdown-menu-content"]',
        '[data-slot="popover-content"]',
        '[data-slot="combobox-panel"]',
        '[data-slot="toaster"]',
        '[data-radix-popper-content-wrapper]',
      ].join(', '),
    )
    .forEach((el) => el.remove())
}

async function collectStyles(): Promise<string> {
  const sheets: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      sheets.push(Array.from(sheet.cssRules || []).map((r) => r.cssText).join('\n'))
    } catch {
      if (sheet.href) {
        try {
          sheets.push(await (await fetch(sheet.href)).text())
        } catch {
          /* cross-origin */
        }
      }
    }
  }
  return sheets.join('\n')
}

function bodyFromPapers(): string {
  const packSections = document.querySelectorAll('section[data-print-paper], section[data-invoice-page]')
  if (packSections.length > 0) {
    return Array.from(packSections)
      .map((section) => {
        const clone = section.cloneNode(true) as HTMLElement
        stripChrome(clone)
        return clone.outerHTML
      })
      .join('\n')
  }

  const articles = document.querySelectorAll<HTMLElement>(
    'article.merchant-invoice, article.invoice-sheet',
  )
  if (articles.length > 0) {
    return Array.from(articles)
      .map((article, i) => {
        const clone = article.cloneNode(true) as HTMLElement
        stripChrome(clone)
        const last = i === articles.length - 1
        const style = last
          ? 'break-after:auto;page-break-after:auto;'
          : 'break-after:page;page-break-after:always;'
        return `<section data-print-paper style="${style}">${clone.outerHTML}</section>`
      })
      .join('\n')
  }

  const report =
    document.querySelector<HTMLElement>('[data-report-root]') ||
    document.querySelector<HTMLElement>('[data-print-root]')
  if (report) {
    const clone = report.cloneNode(true) as HTMLElement
    stripChrome(clone)
    return clone.outerHTML
  }

  return ''
}

/** Full HTML document matching the on-screen print paper(s). */
export async function buildPackPrintHtml(ink: 'color' | 'mono' = 'color'): Promise<string> {
  const bodyHtml = bodyFromPapers()
  if (!bodyHtml.trim()) {
    throw new Error('No printable paper found on this page.')
  }
  const styles = await collectStyles()
  const inkAttr = ink === 'mono' ? ' data-print-ink="mono"' : ''
  return `<!DOCTYPE html><html${inkAttr}><head><meta charset="utf-8"><base href="${location.origin}/"><style>${styles}\n${PRINT_CSS}</style></head><body>${bodyHtml}</body></html>`
}

/** Download a PDF that matches the on-screen paper (Chrome / Edge headless). */
export async function downloadPackPrintPdf(filename: string, ink: 'color' | 'mono'): Promise<boolean> {
  if (!hasPrintablePaper()) return false
  let html: string
  try {
    html = await buildPackPrintHtml(ink)
  } catch {
    return false
  }
  const response = await fetch('/api/print/html-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, filename }),
  })
  if (!response.ok) return false
  const blob = await response.blob()
  if (blob.size < 500) return false
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return true
}
