import { access } from 'node:fs/promises'

import puppeteer, { type Browser } from 'puppeteer-core'

const LOCAL_CHROME = [
  process.env.CHROME_PATH,
  process.env.EDGE_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter((path): path is string => Boolean(path))

async function localChrome(): Promise<string | null> {
  for (const candidate of LOCAL_CHROME) {
    try {
      await access(candidate)
      return candidate
    } catch {
      /* next */
    }
  }
  return null
}

/** Local Chrome when the machine has one; otherwise the serverless Chromium build. */
export async function launchPdfBrowser(): Promise<Browser> {
  const local = await localChrome()
  if (local) {
    return puppeteer.launch({
      executablePath: local,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    })
  }

  const chromium = (await import('@sparticuz/chromium')).default
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
}
