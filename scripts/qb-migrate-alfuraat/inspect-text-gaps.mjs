import fs from 'node:fs'
import path from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

try {
  process.loadEnvFile('.env')
} catch {
  /* ok */
}

const dir = 'C:\\Users\\Zmart\\Desktop\\qb-alfuraat-export'
const orgId = 'cmvezuwzw000507l8ewxbhc15'

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1].trim() : ''
}
function blocks(xml, name) {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g')
  const out = []
  let m
  while ((m = re.exec(xml))) out.push(m[1])
  return out
}
function readAll(prefix) {
  return fs
    .readdirSync(dir)
    .filter((f) => f === `${prefix}.xml` || (f.startsWith(`${prefix}-part`) && f.endsWith('.xml')))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n')
}
function decode(s) {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

const invoices = readAll('invoices')
let qbMemo = 0
let qbPo = 0
let qbOther = 0
let qbDataExt = 0
let qbLineDesc = 0
let sample0970 = null
const qbByNum = new Map()

for (const block of blocks(invoices, 'InvoiceRet')) {
  const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
  if (!number) continue
  const memo = decode(tag(block, 'Memo'))
  const po = tag(block, 'PONumber')
  const other = tag(block, 'Other') || tag(block, 'Other1') || tag(block, 'Other2')
  const custom = blocks(block, 'DataExtRet').map((d) => ({
    name: tag(d, 'DataExtName'),
    value: decode(tag(d, 'DataExtValue')),
  }))
  const lines = blocks(block, 'InvoiceLineRet').map((line) => ({
    desc: decode(tag(line, 'Desc')),
    item: tag(line.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName'),
    qty: tag(line, 'Quantity'),
    rate: tag(line, 'Rate'),
    amount: tag(line, 'Amount'),
  }))
  if (memo) qbMemo++
  if (po) qbPo++
  if (other) qbOther++
  if (custom.length) qbDataExt++
  if (lines.some((l) => l.desc)) qbLineDesc++
  const row = { memo, po, other, custom, lines }
  qbByNum.set(number, row)
  if (number === '0970') sample0970 = row
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const docs = await prisma.salesDocument.findMany({
  where: { orgId, type: 'INVOICE' },
  select: {
    id: true,
    number: true,
    reference: true,
    inRef: true,
    memo: true,
    lines: { select: { lineNumber: true, description: true }, orderBy: { lineNumber: 'asc' } },
  },
})

let missingMemo = 0
let missingPo = 0
let missingIn = 0
let missingLineDesc = 0
let qbHasMemoDbEmpty = 0
let qbHasLineDescDbEmpty = 0

for (const doc of docs) {
  const qb = qbByNum.get(doc.number)
  if (!doc.memo) missingMemo++
  if (!doc.reference) missingPo++
  if (!doc.inRef) missingIn++
  if (doc.lines.some((l) => !l.description)) missingLineDesc++
  if (qb?.memo && !doc.memo) qbHasMemoDbEmpty++
  if (qb?.lines.some((l) => l.desc) && doc.lines.some((l) => !l.description)) qbHasLineDescDbEmpty++
}

// Journal memos that mention IN/
const journals = readAll('journals')
const inFromJe = []
for (const block of blocks(journals, 'JournalEntryLineRet').slice(0, 0)) {
  /* placeholder */
}
const jeMemos = [...journals.matchAll(/<Memo>([^<]*IN\/[^<]*)<\/Memo>/gi)].map((m) => m[1])
const uniqueJe = [...new Set(jeMemos)].slice(0, 15)

console.log(
  JSON.stringify(
    {
      qb: { count: qbByNum.size, qbMemo, qbPo, qbOther, qbDataExt, qbLineDesc },
      db: {
        count: docs.length,
        missingMemo,
        missingPo,
        missingIn,
        missingLineDesc,
        qbHasMemoDbEmpty,
        qbHasLineDescDbEmpty,
      },
      sample0970: sample0970
        ? {
            memo: sample0970.memo,
            po: sample0970.po,
            other: sample0970.other,
            custom: sample0970.custom,
            lineDescs: sample0970.lines.map((l) => l.desc).filter(Boolean).slice(0, 8),
          }
        : null,
      jeInSamples: uniqueJe,
    },
    null,
    2,
  ),
)
await prisma.$disconnect()
