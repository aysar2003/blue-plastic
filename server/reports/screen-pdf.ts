import { NextResponse } from 'next/server'

import { launchPdfBrowser } from '@/server/reports/launch-chrome'

const PAPER_SELECTOR =
  'article.merchant-invoice, article.invoice-sheet, section[data-print-paper], [data-print-root], [data-report-root]'

/**
 * PDF of the on-screen print page (the paper you see when you open Print).
 * Uses the caller's session cookie so the sheet is the same document, template,
 * and columns as the browser, not the plain text PDF.
 */
export async function renderAuthenticatedPagePdf(
  pageUrl: string,
  cookieHeader: string,
): Promise<Buffer | null> {
  if (!cookieHeader.trim()) return null

  let browser: Awaited<ReturnType<typeof launchPdfBrowser>> | null = null
  try {
    browser = await launchPdfBrowser()
    const page = await browser.newPage()
    const url = new URL(pageUrl)
    const cookies = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .flatMap((part) => {
        const eq = part.indexOf('=')
        if (eq <= 0) return []
        return [
          {
            name: part.slice(0, eq),
            value: part.slice(eq + 1),
            url: pageUrl,
            domain: url.hostname,
            path: '/',
          },
        ]
      })
    if (cookies.length > 0) await page.setCookie(...cookies)
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 55_000 })
    await page.waitForSelector(PAPER_SELECTOR, { timeout: 20_000 })
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      format: 'A4',
      margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
    })
    if (pdf.length < 500) throw new Error('Empty PDF')
    return Buffer.from(pdf)
  } catch (error) {
    console.error('[screen-pdf]', error instanceof Error ? error.message : error)
    return null
  } finally {
    await browser?.close().catch(() => undefined)
  }
}

/** Download response when Chrome printed the same page Print shows. */
export async function screenPaperResponse(pageUrl: string, cookieHeader: string, filename: string) {
  const bytes = await renderAuthenticatedPagePdf(pageUrl, cookieHeader)
  if (!bytes || bytes.length < 500) return null
  const safe = filename.replace(/[^\w.-]+/g, '-')
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safe}"`,
      'Cache-Control': 'no-store',
      'X-Paper': 'screen',
    },
  })
}
