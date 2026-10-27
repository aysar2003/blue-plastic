import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { launchPdfBrowser } from '@/server/reports/launch-chrome'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Turn a self-contained HTML snapshot of the print pack into a PDF with the
 * same layout as the browser paper (Chrome / Edge headless).
 */
export async function POST(request: Request) {
  try {
    // Any signed-in company user may PDF the paper already on their screen.
    await requireOrgContext()
    const body = (await request.json()) as { html?: string; filename?: string }
    const html = body.html?.trim()
    if (!html || html.length < 100) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'HTML snapshot is required.' } },
        { status: 400 },
      )
    }
    if (html.length > 4_000_000) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'HTML snapshot is too large.' } },
        { status: 400 },
      )
    }

    const browser = await launchPdfBrowser()
    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'load', timeout: 45_000 })
      const bytes = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        format: 'A4',
        margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
      })
      const filename = sanitizeFilename(body.filename) || 'pack.pdf'
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      })
    } finally {
      await browser.close().catch(() => undefined)
    }
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      )
    }
    console.error('[api/print/html-pdf]', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'PDF could not be built from the print paper.' } },
      { status: 500 },
    )
  }
}

function sanitizeFilename(value: string | undefined): string {
  if (!value?.trim()) return 'pack.pdf'
  const base = value.trim().replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-')
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`
}
