/**
 * Snapshot the open pack/print page HTML (via CDP JSON) or rebuild from a
 * saved CDP response, inject page-break CSS, print with Chrome to Downloads.
 *
 * Usage:
 *   node scripts/export-pack-print-pdf.mjs [cdp-response.json]
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const PRINT_CSS = `
@page { size: A4; margin: 10mm; }
html, body { margin: 0; background: #fff; }
section { break-after: page; page-break-after: always; }
section:last-of-type { break-after: auto; page-break-after: auto; }
.break-inside-avoid { break-inside: avoid !important; page-break-inside: avoid !important; }
`

function findLatestCdpHtml(explicit) {
  if (explicit) {
    const raw = JSON.parse(readFileSync(explicit, 'utf8'))
    const html = raw.result?.result?.value?.html || raw.result?.value?.html
    if (!html) throw new Error(`No HTML in ${explicit}`)
    return html
  }
  const dir = join(homedir(), '.cursor', 'browser-logs')
  const files = readdirSync(dir)
    .filter((n) => n.startsWith('cdp-response-Runtime.evaluate-') && n.endsWith('.json'))
    .map((n) => join(dir, n))
    .sort()
  for (let i = files.length - 1; i >= 0; i--) {
    try {
      const raw = JSON.parse(readFileSync(files[i], 'utf8'))
      const html = raw.result?.result?.value?.html || raw.result?.value?.html
      if (html && html.includes('merchant-invoice') && html.length > 50_000) return html
    } catch {
      /* skip */
    }
  }
  throw new Error('No pack-print CDP HTML snapshot found. Capture the page first.')
}

const htmlIn = findLatestCdpHtml(process.argv[2])
const injected = htmlIn.includes('</head>')
  ? htmlIn.replace('</head>', `<style>${PRINT_CSS}</style></head>`)
  : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${PRINT_CSS}</style></head><body>${htmlIn}</body></html>`

const htmlPath = join(tmpdir(), 'afg-quotations-pack-print.html')
const pdfPath = join(homedir(), 'Downloads', 'AFG-quotations-October-2026-8papers-print.pdf')
writeFileSync(htmlPath, injected, 'utf8')
console.log(`HTML=${htmlPath} bytes=${injected.length}`)

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
execFileSync(
  chrome,
  ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, htmlPath],
  { stdio: 'inherit', timeout: 90_000 },
)

console.log(`PDF=${pdfPath} size=${statSync(pdfPath).size}`)
execFileSync('cmd', ['/c', 'start', '', pdfPath], { stdio: 'ignore' })
