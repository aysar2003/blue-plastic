import 'server-only'

import type { Page } from 'puppeteer-core'

/**
 * Block every outbound fetch while rendering untrusted / client-supplied HTML
 * to PDF. Only document-local schemes may proceed (data / blob / about).
 */
export async function lockPdfPageToOffline(page: Page): Promise<void> {
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    if (request.isInterceptResolutionHandled()) return
    const url = request.url()
    if (
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
      url === 'about:blank' ||
      url.startsWith('about:blank#')
    ) {
      void request.continue()
      return
    }
    void request.abort('blockedbyclient')
  })
}

/**
 * For authenticated screen PDFs: only same-origin + local schemes.
 * Blocks SSRF via injected remote subresources on the print page.
 */
export async function lockPdfPageToOrigin(page: Page, origin: string): Promise<void> {
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    if (request.isInterceptResolutionHandled()) return
    const url = request.url()
    if (
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
      url === 'about:blank' ||
      url.startsWith('about:blank#')
    ) {
      void request.continue()
      return
    }
    try {
      if (new URL(url).origin === origin) {
        void request.continue()
        return
      }
    } catch {
      /* abort */
    }
    void request.abort('blockedbyclient')
  })
}
