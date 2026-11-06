/**
 * Backfill memo, line descriptions, and IN/ from the QB export (+ journal memos).
 * Usage: node scripts/qb-migrate-alfuraat/backfill-text-fields.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

try {
  process.loadEnvFile('.env')
} catch {
  /* ok */
}

const ORG_ID = 'cmvezuwzw000507l8ewxbhc15'
const dir = 'C:\\Users\\Zmart\\Desktop\\qb-alfuraat-export'

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
function inRefFromBlock(block) {
  for (const d of blocks(block, 'DataExtRet')) {
    const name = tag(d, 'DataExtName').toUpperCase()
    if (name === 'IN/' || name === 'IN' || name.includes('IN/')) {
      const value = decode(tag(d, 'DataExtValue'))
      if (value) return value.slice(0, 120)
    }
  }
  const other = tag(block, 'Other') || tag(block, 'Other1') || tag(block, 'Other2')
  return other ? decode(other).slice(0, 120) : ''
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const invoicesXml = readAll('invoices')
const billsXml = readAll('bills')
const journalsXml = readAll('journals')

/** invoice RefNumber → IN/ scraped from JE memos like "INVOICE 1228 PO19031 GRN IN/01401" */
const inFromJe = new Map()
for (const m of journalsXml.matchAll(/INVOICE\s+(\d+)\b[\s\S]{0,80}?IN\/\s*([A-Za-z0-9._\/\- ]+)/gi)) {
  const num = m[1]
  const value = m[2].trim().replace(/\s+/g, ' ').slice(0, 120)
  if (!num || !value) continue
  const prev = inFromJe.get(num)
  if (!prev) inFromJe.set(num, value)
  else if (!prev.includes(value)) inFromJe.set(num, `${prev} ${value}`.slice(0, 120))
}

const qbInv = new Map()
for (const block of blocks(invoicesXml, 'InvoiceRet')) {
  const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
  if (!number) continue
  qbInv.set(number, {
    memo: decode(tag(block, 'Memo')) || null,
    po: tag(block, 'PONumber') || null,
    inRef: inRefFromBlock(block) || inFromJe.get(number.replace(/^0+/, '')) || inFromJe.get(number) || null,
    lines: blocks(block, 'InvoiceLineRet').map((line) => ({
      desc: decode(tag(line, 'Desc')) || null,
      amount: tag(line, 'Amount') || null,
      qty: tag(line, 'Quantity') || null,
      item: tag(line.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName') || null,
    })),
  })
}

const qbBill = new Map()
for (const block of blocks(billsXml, 'BillRet')) {
  const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
  if (!number) continue
  const itemLines = blocks(block, 'ItemLineRet').map((line) => ({
    desc: decode(tag(line, 'Desc')) || null,
    amount: tag(line, 'Amount') || null,
  }))
  const expLines = blocks(block, 'ExpenseLineRet').map((line) => ({
    desc: decode(tag(line, 'Memo') || tag(line, 'Desc')) || null,
    amount: tag(line, 'Amount') || null,
  }))
  qbBill.set(number, {
    memo: decode(tag(block, 'Memo')) || null,
    lines: [...itemLines, ...expLines],
  })
}

const docs = await prisma.salesDocument.findMany({
  where: { orgId: ORG_ID, type: 'INVOICE' },
  select: {
    id: true,
    number: true,
    reference: true,
    inRef: true,
    memo: true,
    lines: {
      select: { id: true, lineNumber: true, description: true, amount: true },
      orderBy: { lineNumber: 'asc' },
    },
  },
})

let memoN = 0
let poN = 0
let inN = 0
let lineN = 0

for (const doc of docs) {
  const qb = qbInv.get(doc.number)
  if (!qb) continue
  const data = {}
  if (qb.memo && !doc.memo) {
    data.memo = qb.memo.slice(0, 1000)
    memoN++
  }
  if (qb.po && !doc.reference) {
    data.reference = qb.po.slice(0, 60)
    poN++
  }
  if (qb.inRef && !doc.inRef) {
    data.inRef = qb.inRef.slice(0, 120)
    inN++
  }
  if (Object.keys(data).length) {
    await prisma.salesDocument.update({ where: { id: doc.id }, data })
  }

  // Match lines by index; fill empty descriptions from QB Desc.
  const qbLines = qb.lines.filter((l) => l.item || l.desc || l.amount)
  for (let i = 0; i < doc.lines.length && i < qbLines.length; i++) {
    const dbLine = doc.lines[i]
    const qbLine = qbLines[i]
    if (dbLine.description || !qbLine.desc) continue
    await prisma.salesDocumentLine.update({
      where: { id: dbLine.id },
      data: { description: qbLine.desc.slice(0, 500) },
    })
    lineN++
  }
}

const bills = await prisma.purchaseDocument.findMany({
  where: { orgId: ORG_ID, type: 'BILL' },
  select: {
    id: true,
    number: true,
    memo: true,
    lines: {
      select: { id: true, lineNumber: true, description: true },
      orderBy: { lineNumber: 'asc' },
    },
  },
})

let billMemoN = 0
let billLineN = 0
for (const doc of bills) {
  const qb = qbBill.get(doc.number)
  if (!qb) continue
  if (qb.memo && !doc.memo) {
    await prisma.purchaseDocument.update({
      where: { id: doc.id },
      data: { memo: qb.memo.slice(0, 1000) },
    })
    billMemoN++
  }
  const qbLines = qb.lines.filter((l) => l.desc || l.amount)
  for (let i = 0; i < doc.lines.length && i < qbLines.length; i++) {
    const dbLine = doc.lines[i]
    const qbLine = qbLines[i]
    if (dbLine.description || !qbLine.desc) continue
    await prisma.purchaseDocumentLine.update({
      where: { id: dbLine.id },
      data: { description: qbLine.desc.slice(0, 500) },
    })
    billLineN++
  }
}

const sample = await prisma.salesDocument.findFirst({
  where: { orgId: ORG_ID, type: 'INVOICE', number: '0970' },
  select: {
    number: true,
    reference: true,
    inRef: true,
    memo: true,
    lines: { select: { lineNumber: true, description: true }, orderBy: { lineNumber: 'asc' }, take: 6 },
  },
})

console.log(
  JSON.stringify(
    {
      invoices: { memoN, poN, inN, lineN, jeInKeys: inFromJe.size },
      bills: { billMemoN, billLineN },
      sample0970: sample,
    },
    null,
    2,
  ),
)
await prisma.$disconnect()
