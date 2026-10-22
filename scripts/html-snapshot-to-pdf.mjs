import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const src =
  process.argv[2] ||
  'C:\\Users\\Zmart\\.cursor\\browser-logs\\cdp-response-Runtime.evaluate-2026-10-22T12-48-55-728Z.json'

const raw = JSON.parse(readFileSync(src, 'utf8'))
const html = raw.result?.result?.value?.html || raw.result?.value?.html
if (!html) {
  console.error('No HTML in CDP response')
  console.error(Object.keys(raw))
  process.exit(1)
}

const htmlPath = join(tmpdir(), 'afg-quotations-pack-print.html')
const pdfPath = join(homedir(), 'Downloads', 'AFG-quotations-October-2026-8papers-print.pdf')
writeFileSync(htmlPath, html, 'utf8')
console.log(`HTML=${htmlPath}`)
console.log(`BYTES=${html.length}`)
console.log(`ARTICLES=${(html.match(/<article/g) || []).length}`)

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
execFileSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    htmlPath,
  ],
  { stdio: 'inherit', timeout: 90_000 },
)

const st = statSync(pdfPath)
console.log(`PDF=${pdfPath}`)
console.log(`SIZE=${st.size}`)
execFileSync('cmd', ['/c', 'start', '', pdfPath], { stdio: 'ignore' })
execFileSync('explorer.exe', [`/select,${pdfPath}`], { stdio: 'ignore' })
