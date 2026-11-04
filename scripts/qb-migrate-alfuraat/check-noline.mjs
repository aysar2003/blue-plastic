import fs from 'node:fs'
import path from 'node:path'

const dirs = [
  path.join(process.env.USERPROFILE ?? 'C:\\Users\\Zmart', 'Desktop', 'qb-alfuraat-export'),
  'C:\\Users\\Zmart\\qb-export',
]
const dir = dirs.find((d) => fs.existsSync(path.join(d, 'items.xml')))
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1].trim() : ''
}
const blocks = (xml, name) => {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g')
  const out = []
  let m
  while ((m = re.exec(xml))) out.push(m[1])
  return out
}
const readAll = (prefix) =>
  fs
    .readdirSync(dir)
    .filter((f) => f === `${prefix}.xml` || (f.startsWith(`${prefix}-part`) && f.endsWith('.xml')))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n')

let withAmt = 0
let zero = 0
const samples = []
for (const b of blocks(readAll('invoices'), 'InvoiceRet')) {
  const lines = blocks(b, 'InvoiceLineRet')
  const withItem = lines.filter((l) => tag(l.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName'))
  if (withItem.length) continue
  const n = tag(b, 'RefNumber') || tag(b, 'TxnNumber')
  const sub = Number(tag(b, 'Subtotal') || '0')
  const lineAmts = lines.map((l) => ({
    desc: (tag(l, 'Desc') || '').slice(0, 40),
    amt: tag(l, 'Amount'),
    item: tag(l.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName'),
  }))
  if (sub > 0) {
    withAmt++
    if (samples.length < 5) samples.push({ n, sub, lineAmts })
  } else zero++
}
console.log(JSON.stringify({ withAmt, zero, samples }, null, 2))
