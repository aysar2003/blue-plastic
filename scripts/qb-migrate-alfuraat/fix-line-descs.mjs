/**
 * Align QB InvoiceLineRet / Bill lines to DB lines by order and copy Desc/Memo.
 * Also set IN/ from DataExt/Other or journal memo patterns.
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

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
})

const invoicesXml = readAll('invoices')
const billsXml = readAll('bills')
const journalsXml = readAll('journals')

const inFromJe = new Map()
for (const m of journalsXml.matchAll(/INVOICE\s+0*(\d+)\b[\s\S]{0,120}?IN\/\s*([A-Za-z0-9._\/\- ]+)/gi)) {
  const num = String(Number(m[1])) // normalize 0970 → keep both keys
  const raw = m[1]
  const value = m[2].trim().replace(/\s+/g, ' ').slice(0, 120)
  for (const key of [raw, num, raw.padStart(4, '0')]) {
    if (!inFromJe.has(key)) inFromJe.set(key, value)
  }
}

const qbInv = new Map()
for (const block of blocks(invoicesXml, 'InvoiceRet')) {
  const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
  if (!number) continue
  let inRef = ''
  for (const d of blocks(block, 'DataExtRet')) {
    const name = tag(d, 'DataExtName').toUpperCase()
    if (name === 'IN/' || name === 'IN' || name.includes('IN/')) {
      inRef = decode(tag(d, 'DataExtValue'))
      break
    }
  }
  if (!inRef) inRef = tag(block, 'Other') || tag(block, 'Other1') || tag(block, 'Other2')
  if (!inRef) inRef = inFromJe.get(number) || inFromJe.get(String(Number(number))) || ''

  // Keep every item line in QB order (including blank Desc) so indexes match the paper.
  const lines = []
  for (const line of blocks(block, 'InvoiceLineRet')) {
    const item = tag(line.match(/<ItemRef>[\s\S]*?<\/ItemRef>/)?.[0] ?? '', 'FullName')
    if (!item && !tag(line, 'Amount')) continue
    lines.push({
      desc: decode(tag(line, 'Desc')) || '',
      amount: Number(tag(line, 'Amount') || 0),
      qty: Number(tag(line, 'Quantity') || 0),
    })
  }
  qbInv.set(number, {
    memo: decode(tag(block, 'Memo')) || '',
    po: tag(block, 'PONumber') || '',
    inRef: inRef ? decode(inRef).slice(0, 120) : '',
    lines,
  })
}

let lineUpdates = 0
let headerUpdates = 0
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

for (const doc of docs) {
  const qb = qbInv.get(doc.number)
  if (!qb) continue

  const header = {}
  if (qb.memo && !doc.memo) header.memo = qb.memo.slice(0, 1000)
  if (qb.po && !doc.reference) header.reference = qb.po.slice(0, 60)
  if (qb.inRef && !doc.inRef) header.inRef = qb.inRef
  if (Object.keys(header).length) {
    await prisma.salesDocument.update({ where: { id: doc.id }, data: header })
    headerUpdates++
  }

  // Prefer index match when counts equal; else match by amount+qty.
  const byIndex = doc.lines.length === qb.lines.length
  const used = new Set()
  for (let i = 0; i < doc.lines.length; i++) {
    const dbLine = doc.lines[i]
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
    if ((dbLine.description || '').trim() === qbLine.desc.trim()) continue
    // Always prefer QB Desc when DB is empty or was wrongly filled from a shifted index.
    if (!dbLine.description || dbLine.description.trim() !== qbLine.desc.trim()) {
      await prisma.salesDocumentLine.update({
        where: { id: dbLine.id },
        data: { description: qbLine.desc.slice(0, 500) },
      })
      lineUpdates++
    }
  }
}

// Bills
const qbBill = new Map()
for (const block of blocks(billsXml, 'BillRet')) {
  const number = tag(block, 'RefNumber') || tag(block, 'TxnNumber')
  if (!number) continue
  const lines = []
  for (const line of blocks(block, 'ItemLineRet')) {
    lines.push({
      desc: decode(tag(line, 'Desc')) || '',
      amount: Number(tag(line, 'Amount') || 0),
    })
  }
  for (const line of blocks(block, 'ExpenseLineRet')) {
    lines.push({
      desc: decode(tag(line, 'Memo') || tag(line, 'Desc')) || '',
      amount: Number(tag(line, 'Amount') || 0),
    })
  }
  qbBill.set(number, { memo: decode(tag(block, 'Memo')) || '', lines })
}

let billLineUpdates = 0
let billHeaderUpdates = 0
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
for (const doc of bills) {
  const qb = qbBill.get(doc.number)
  if (!qb) continue
  if (qb.memo && !doc.memo) {
    await prisma.purchaseDocument.update({
      where: { id: doc.id },
      data: { memo: qb.memo.slice(0, 1000) },
    })
    billHeaderUpdates++
  }
  const byIndex = doc.lines.length === qb.lines.length
  for (let i = 0; i < doc.lines.length; i++) {
    const dbLine = doc.lines[i]
    const qbLine = byIndex
      ? qb.lines[i]
      : qb.lines.find((l) => Math.abs(l.amount - Number(dbLine.amount)) < 0.01)
    if (!qbLine?.desc) continue
    if ((dbLine.description || '').trim() === qbLine.desc.trim()) continue
    if (!dbLine.description || dbLine.description.trim() !== qbLine.desc.trim()) {
      await prisma.purchaseDocumentLine.update({
        where: { id: dbLine.id },
        data: { description: qbLine.desc.slice(0, 500) },
      })
      billLineUpdates++
    }
  }
}

const sample = await prisma.salesDocument.findFirst({
  where: { orgId: ORG_ID, type: 'INVOICE', number: '0970' },
  select: {
    number: true,
    reference: true,
    inRef: true,
    memo: true,
    lines: { select: { lineNumber: true, description: true }, orderBy: { lineNumber: 'asc' }, take: 10 },
  },
})

const withIn = await prisma.salesDocument.count({
  where: { orgId: ORG_ID, type: 'INVOICE', inRef: { not: null } },
})
const withDesc = await prisma.salesDocumentLine.count({
  where: { orgId: ORG_ID, description: { not: null }, document: { type: 'INVOICE' } },
})

console.log(
  JSON.stringify(
    {
      invoices: { headerUpdates, lineUpdates, withIn, withDesc, jeInKeys: inFromJe.size },
      bills: { billHeaderUpdates, billLineUpdates },
      sample0970: sample,
    },
    null,
    2,
  ),
)
await prisma.$disconnect()
