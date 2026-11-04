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

let withEntity = 0
let without = 0
const samples = []
for (const b of blocks(readAll('journals'), 'JournalEntryRet').slice(0, 50)) {
  for (const line of [...blocks(b, 'JournalDebitLine'), ...blocks(b, 'JournalCreditLine')]) {
    const acct = tag(line.match(/<AccountRef>[\s\S]*?<\/AccountRef>/)?.[0] ?? '', 'FullName')
    if (!/payable|receivable/i.test(acct)) continue
    const entity = tag(line.match(/<EntityRef>[\s\S]*?<\/EntityRef>/)?.[0] ?? '', 'FullName')
    if (entity) withEntity++
    else without++
    if (samples.length < 8) {
      samples.push({
        date: tag(b, 'TxnDate'),
        acct,
        entity,
        amt: tag(line, 'Amount'),
        snippet: line.slice(0, 400),
      })
    }
  }
}
console.log(JSON.stringify({ withEntity, without, samples }, null, 2))
