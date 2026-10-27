import { NextResponse } from 'next/server'

import { spawn } from 'node:child_process'
import { access, mkdtemp, rm } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.EDGE_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter((path): path is string => Boolean(path))

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
  const chrome = await resolveChrome()
  if (!chrome) return null

  const dir = await mkdtemp(join(tmpdir(), 'screen-pdf-'))
  const port = await freePort()
  const child = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${dir}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  try {
    const browserWs = await waitForDebugger(port)
    return await printPage(browserWs, pageUrl, cookieHeader)
  } catch (error) {
    console.error('[screen-pdf]', error instanceof Error ? error.message : error)
    return null
  } finally {
    child.kill()
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function resolveChrome(): Promise<string | null> {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate)
      return candidate
    } catch {
      /* next */
    }
  }
  return null
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

async function waitForDebugger(port: number): Promise<string> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (response.ok) {
        const body = (await response.json()) as { webSocketDebuggerUrl?: string }
        if (body.webSocketDebuggerUrl) return body.webSocketDebuggerUrl
      }
    } catch {
      /* chrome still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('Chrome did not open a debugger port.')
}

type CdpResult = { id: number; result?: Record<string, unknown>; error?: { message: string } }

async function printPage(browserWs: string, pageUrl: string, cookieHeader: string): Promise<Buffer> {
  const browser = new WebSocket(browserWs)
  await new Promise<void>((resolve, reject) => {
    browser.addEventListener('open', () => resolve())
    browser.addEventListener('error', () => reject(new Error('Could not connect to Chrome.')))
  })

  let nextId = 0
  const pending = new Map<number, (message: CdpResult) => void>()
  browser.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as CdpResult
    const done = pending.get(message.id)
    if (done) {
      pending.delete(message.id)
      done(message)
    }
  })

  const call = (method: string, params: Record<string, unknown> = {}, sessionId?: string) => {
    const id = ++nextId
    const payload = sessionId ? { id, method, params, sessionId } : { id, method, params }
    browser.send(JSON.stringify(payload))
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 45_000)
      pending.set(id, (message) => {
        clearTimeout(timer)
        if (message.error) reject(new Error(message.error.message))
        else resolve(message.result ?? {})
      })
    })
  }

  try {
    const created = await call('Target.createTarget', { url: 'about:blank' })
    const attached = await call('Target.attachToTarget', { targetId: created.targetId, flatten: true })
    const sessionId = String(attached.sessionId)
    await call('Page.enable', {}, sessionId)
    await call('Network.enable', {}, sessionId)

    const url = new URL(pageUrl)
    for (const part of cookieHeader.split(';')) {
      const trimmed = part.trim()
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      await call(
        'Network.setCookie',
        {
          name: trimmed.slice(0, eq),
          value: trimmed.slice(eq + 1),
          url: pageUrl,
          domain: url.hostname,
          path: '/',
        },
        sessionId,
      )
    }

    await call('Page.navigate', { url: pageUrl }, sessionId)
    const ready = Date.now() + 55_000
    let paper = false
    while (Date.now() < ready) {
      const evaluated = await call(
        'Runtime.evaluate',
        { expression: 'Boolean(document.querySelector("article.merchant-invoice, article.invoice-sheet, section[data-print-paper], [data-print-root], [data-report-root]"))', returnByValue: true },
        sessionId,
      )
      const result = evaluated.result as { value?: boolean } | undefined
      if (result?.value) {
        paper = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    if (!paper) throw new Error('Print paper did not appear.')

    const printed = await call(
      'Page.printToPDF',
      {
        printBackground: true,
        preferCSSPageSize: true,
        paperWidth: 8.27,
        paperHeight: 11.69,
        marginTop: 0.47,
        marginBottom: 0.47,
        marginLeft: 0.47,
        marginRight: 0.47,
      },
      sessionId,
    )
    const data = printed.data
    if (typeof data !== 'string' || data.length < 100) throw new Error('Empty PDF')
    return Buffer.from(data, 'base64')
  } finally {
    browser.close()
  }
}

/** Download response when Chrome printed the same page Print shows. */
export async function screenPaperResponse(pageUrl: string, cookieHeader: string, filename: string) {
  const bytes = await renderAuthenticatedPagePdf(pageUrl, cookieHeader)
  if (!bytes || bytes.length < 500) return null
  const safe = filename.replace(/[^\w.-]+/g, '-')
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safe}"`,
      'Cache-Control': 'no-store',
      'X-Paper': 'screen',
    },
  })
}
