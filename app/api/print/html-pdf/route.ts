import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const execFileAsync = promisify(execFile)

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.EDGE_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter((path): path is string => Boolean(path))

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

    const chrome = await resolveChrome()
    if (!chrome) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAVAILABLE',
            message: 'Chrome/Edge is not available for HTML PDF on this host.',
          },
        },
        { status: 503 },
      )
    }

    const dir = await mkdtemp(join(tmpdir(), 'pack-html-pdf-'))
    const htmlPath = join(dir, 'pack.html')
    const pdfPath = join(dir, 'pack.pdf')
    try {
      await writeFile(htmlPath, html, 'utf8')
      await execFileAsync(
        chrome,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-pdf-header-footer',
          `--print-to-pdf=${pdfPath}`,
          htmlPath,
        ],
        { timeout: 90_000 },
      )
      const bytes = await readFile(pdfPath)
      const filename = sanitizeFilename(body.filename) || 'pack.pdf'
      return new NextResponse(bytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      })
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined)
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

async function resolveChrome(): Promise<string | null> {
  const { access } = await import('node:fs/promises')
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate)
      return candidate
    } catch {
      /* try next */
    }
  }
  return null
}

function sanitizeFilename(value: string | undefined): string {
  if (!value?.trim()) return 'pack.pdf'
  const base = value.trim().replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-')
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`
}
