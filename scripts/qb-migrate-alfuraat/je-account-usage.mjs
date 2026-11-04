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

const counts = new Map()
for (const b of blocks(readAll('journals'), 'JournalEntryRet')) {
  for (const line of [...blocks(b, 'JournalDebitLine'), ...blocks(b, 'JournalCreditLine')]) {
    const a = tag(line.match(/<AccountRef>[\s\S]*?<\/AccountRef>/)?.[0] ?? '', 'FullName')
    if (!a) continue
    counts.set(a, (counts.get(a) || 0) + 1)
  }
}
console.log([...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}\t${k}`).join('\n'))

const payments = blocks(readAll('payments'), 'ReceivePaymentRet')
console.log('payments', payments.length)
for (const p of payments.slice(0, 3)) {
  console.log({
    ref: tag(p, 'RefNumber'),
    cust: tag(p.match(/<CustomerRef>[\s\S]*?<\/CustomerRef>/)?.[0] ?? '', 'FullName'),
    amt: tag(p, 'TotalAmount'),
    date: tag(p, 'TxnDate'),
  })
}
