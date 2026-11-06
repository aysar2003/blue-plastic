import fs from 'node:fs'
import path from 'node:path'

const dir = 'C:\\Users\\Zmart\\Desktop\\qb-alfuraat-export'
function tag(xml: string, name: string) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1]!.trim() : ''
}
function blocks(xml: string, name: string) {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out.push(m[1]!)
  return out
}
function readAll(prefix: string) {
  return fs
    .readdirSync(dir)
    .filter((f) => f === `${prefix}.xml` || (f.startsWith(`${prefix}-part`) && f.endsWith('.xml')))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n')
}

const files = fs.readdirSync(dir)
console.log(
  'files',
  files.filter((f) => /credit|payment|invoice|journal/i.test(f)).slice(0, 40),
)

// How many payments have empty apps, and applied types
const payments = blocks(readAll('payments'), 'ReceivePaymentRet')
const byType: Record<string, number> = {}
let empty = 0
for (const p of payments) {
  const apps = blocks(p, 'AppliedToTxnRet')
  if (!apps.length) empty++
  for (const a of apps) {
    const t = tag(a, 'TxnType') || '?'
    byType[t] = (byType[t] ?? 0) + 1
  }
}
console.log({ paymentCount: payments.length, emptyApps: empty, byType })
