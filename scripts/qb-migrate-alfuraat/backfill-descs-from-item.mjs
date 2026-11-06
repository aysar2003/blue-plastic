/**
 * Fill empty sales/bill line descriptions from QB Desc, else item FullName.
 * Also set inRef from journal memos (INVOICE n … IN/xxxx) when present.
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
  const files = fs
    .readdirSync(dir)
    .filter((f) => f === `${prefix}.xml` || (f.startsWith(`${prefix}-part`) && f.endsWith('.xml')))
    .sort()
  console.error(`reading ${prefix}: ${files.length} files`)
  return files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
}
function decode(s) {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

console.error('connecting…')
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const invoicesXml = readAll('invoices')
const billsXml = readAll('bills')
const journalsXml = readAll('journals')

const inFromJe = new Map()
for (const m of journalsXml.matchAll(/INVOICE\s+0*(\d+)\b[\s\S]{0,120}?IN\/\s*([A-Za-z0-9._\/\-]+)/gi)) {
  const raw = m[1]
  const value = m[2].trim().slice(0, 120)
  for (const key of [raw, String(Number(raw)), raw.padStart(4, '0')]) {
    if (!inFromJe.has(key)) inFromJe.set(key, value)
  }
}
console.error(`je IN/ keys: ${inFromJe.size}`)

const qbInv = new Map()
for (const block of blocks(invoicesXml, 'InvoiceRet')) {
  const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
  if (!number) continue
  const lines = []
  for (const line of blocks(block, 'InvoiceLineRet')) {
    const item = decode(tag(line.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName'))
    const amount = Number(tag(line, 'Amount') || 0)
    if (!item && !amount) continue
    const desc = decode(tag(line, 'Desc'))
    lines.push({
      desc: (desc || item || '').slice(0, 500),
      amount,
      qty: Number(tag(line, 'Quantity') || 0),
    })
  }
  qbInv.set(number, {
    memo: decode(tag(block, 'Memo')) || '',
    po: tag(block, 'PONumber') || '',
    inRef: inFromJe.get(number) || inFromJe.get(String(Number(number))) || '',
    lines,
  })
}
console.error(`qb invoices: ${qbInv.size}`)

console.error('loading sales docs…')
const docs = await prisma.salesDocument.findMany({
  where: { orgId: ORG_ID, type: 'INVOICE' },
  select: {
    id: true,
    number: true,
    reference: true,
    inRef: true,
    memo: true,
    lines: {
      select: { id: true, lineNumber: true, description: true, amount: true, quantity: true },
      orderBy: { lineNumber: 'asc' },
    },
  },
})
console.error(`db invoices: ${docs.length}`)

const headerOps = []
const lineOps = []

for (const doc of docs) {
  const qb = qbInv.get(doc.number)
  if (!qb) continue
  const header = {}
  if (qb.memo && !doc.memo) header.memo = qb.memo.slice(0, 1000)
  if (qb.po && !doc.reference) header.reference = qb.po.slice(0, 60)
  if (qb.inRef && !doc.inRef) header.inRef = qb.inRef
  if (Object.keys(header).length) {
    headerOps.push(prisma.salesDocument.update({ where: { id: doc.id }, data: header }))
  }

  const byIndex = doc.lines.length === qb.lines.length
  const used = new Set()
  for (let i = 0; i < doc.lines.length; i++) {
    const dbLine = doc.lines[i]
    if ((dbLine.description || '').trim()) continue
    let qbLine = byIndex ? qb.lines[i] : null
    if (!qbLine) {
      const amt = Number(dbLine.amount)
      const qty = Number(dbLine.quantity)
      const idx = qb.lines.findIndex(
        (l, j) => !used.has(j) && Math.abs(l.amount - amt) < 0.01 && Math.abs(l.qty - qty) < 0.01,
      )
      if (idx >= 0) {
        used.add(idx)
        qbLine = qb.lines[idx]
      }
    } else {
      used.add(i)
    }
    if (!qbLine?.desc) continue
    lineOps.push(
      prisma.salesDocumentLine.update({
        where: { id: dbLine.id },
        data: { description: qbLine.desc },
      }),
    )
  }
}

console.error(`sales header ops ${headerOps.length}, line ops ${lineOps.length}`)
for (let i = 0; i < headerOps.length; i++) {
  await headerOps[i]
  if (i % 25 === 0) console.error(`headers ${i + 1}/${headerOps.length}`)
}
for (let i = 0; i < lineOps.length; i++) {
  await lineOps[i]
  if (i % 50 === 0) console.error(`lines ${i + 1}/${lineOps.length}`)
}

const qbBill = new Map()
for (const block of blocks(billsXml, 'BillRet')) {
  const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
  if (!number) continue
  const lines = []
  for (const line of blocks(block, 'ItemLineRet')) {
    const item = decode(tag(line.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName'))
    const desc = decode(tag(line, 'Desc'))
    lines.push({ desc: (desc || item || '').slice(0, 500), amount: Number(tag(line, 'Amount') || 0) })
  }
  for (const line of blocks(block, 'ExpenseLineRet')) {
    const desc = decode(tag(line, 'Memo') || tag(line, 'Desc'))
    lines.push({ desc: desc.slice(0, 500), amount: Number(tag(line, 'Amount') || 0) })
  }
  qbBill.set(number, { memo: decode(tag(block, 'Memo')) || '', lines })
}

console.error('loading bills…')
const bills = await prisma.purchaseDocument.findMany({
  where: { orgId: ORG_ID, type: 'BILL' },
  select: {
    id: true,
    number: true,
    memo: true,
    lines: {
      select: { id: true, description: true, amount: true },
      orderBy: { lineNumber: 'asc' },
    },
  },
})

const billHeaderOps = []
const billLineOps = []
for (const doc of bills) {
  const qb = qbBill.get(doc.number)
  if (!qb) continue
  if (qb.memo && !doc.memo) {
    billHeaderOps.push(
      prisma.purchaseDocument.update({
        where: { id: doc.id },
        data: { memo: qb.memo.slice(0, 1000) },
      }),
    )
  }
  const byIndex = doc.lines.length === qb.lines.length
  for (let i = 0; i < doc.lines.length; i++) {
    const dbLine = doc.lines[i]
    if ((dbLine.description || '').trim()) continue
    const qbLine = byIndex
      ? qb.lines[i]
      : qb.lines.find((l) => Math.abs(l.amount - Number(dbLine.amount)) < 0.01)
    if (!qbLine?.desc) continue
    billLineOps.push(
      prisma.purchaseDocumentLine.update({
        where: { id: dbLine.id },
        data: { description: qbLine.desc },
      }),
    )
  }
}
console.error(`bill header ops ${billHeaderOps.length}, line ops ${billLineOps.length}`)
for (let i = 0; i < billHeaderOps.length; i++) await billHeaderOps[i]
for (let i = 0; i < billLineOps.length; i++) {
  await billLineOps[i]
  if (i % 50 === 0) console.error(`bill lines ${i + 1}/${billLineOps.length}`)
}

const sample = await prisma.salesDocument.findFirst({
  where: { orgId: ORG_ID, type: 'INVOICE', number: '0970' },
  select: {
    number: true,
    reference: true,
    inRef: true,
    lines: { select: { lineNumber: true, description: true }, orderBy: { lineNumber: 'asc' }, take: 8 },
  },
})
const sample1228 = await prisma.salesDocument.findFirst({
  where: { orgId: ORG_ID, type: 'INVOICE', number: '1228' },
  select: { number: true, reference: true, inRef: true },
})
const withIn = await prisma.salesDocument.count({
  where: { orgId: ORG_ID, type: 'INVOICE', NOT: { inRef: null } },
})

console.log(
  JSON.stringify(
    {
      invoices: {
        headerUpdates: headerOps.length,
        lineUpdates: lineOps.length,
        withIn,
        jeInKeys: inFromJe.size,
      },
      bills: { billHeaderUpdates: billHeaderOps.length, billLineUpdates: billLineOps.length },
      sample0970: sample,
      sample1228,
    },
    null,
    2,
  ),
)
await prisma.$disconnect()
